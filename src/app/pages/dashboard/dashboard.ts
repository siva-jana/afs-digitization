import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../../src/environments/environment';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { of, } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ViewChildren, ElementRef, QueryList } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { HostListener } from '@angular/core';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { NgIf } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    [NgIf]],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  username = localStorage.getItem('loggedInUser') || 'User';
  fullName = localStorage.getItem('userFullName') || '';
  email = localStorage.getItem('userEmail') || '';
  role = localStorage.getItem('userRole') || '';
  lastLoginTime = localStorage.getItem('lastLoginTime') || '';


  showPopup = false;
  showMetricsPopup = false;
  showDatePopup = false;
  //userMetrics = { digitizedFiles: 0, digitizedPages: 0, failedFiles: 0 ,updatedAt: '' };
  globalMetrics = { digitizedFiles: 0, digitizedPages: 0, failedFiles: 0, updatedAt: '' };


  constructor(private router: Router, private http: HttpClient,) { }

  filters = {
    states: [] as any[],
    populationCategories: [] as string[],
    allCities: [] as any[],
    cities: [] as any[],
    years: [] as any[],
    // documentTypes: [] as { key: string, name: string }[]
    documentTypes: [] as {
      heading: string;
      items: { key: string; name: string }[];
    }[]

  };

  selectedState = '';
  selectedPopulation = '';
  selectedCities: string[] = [];
  selectedYear = '';
  selectedDocType = '';
  // isAudited = false;
  isAudited: string | null = null;
  isLoading = false;
  allFilteredFiles: any[] = []; // stores results from applyFilters()

  showCalendar = false;
  // digitizedStartDate: string = '';
  // digitizedEndDate: string = '';
  digitizedStartDate: Date | null = null;
  digitizedEndDate: Date | null = null;
  today = new Date();






  openDatePopup() {
    this.showDatePopup = true;
  }

  closeDatePopup() {
    this.showDatePopup = false;
  }

  toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
  }

  applyDateRange(): void {

    if (!this.digitizedStartDate || !this.digitizedEndDate) {
      alert("⚠️ Please select both start and end dates");
      return;
    }

    if (!this.isDateRangeValid()) {
      alert("⚠️ Start date cannot be after End date");
      return;
    }

    this.showCalendar = false;
    this.showDatePopup = false;

    if (this.digitizedStartDate && this.digitizedEndDate) {
      console.log('📅 Selected range:', this.digitizedStartDate, 'to', this.digitizedEndDate);

      const start = new Date(this.digitizedStartDate);
      const end = new Date(this.digitizedEndDate);
      end.setHours(23, 59, 59, 999);

      const dateFiltered = this.allFilteredFiles.filter(file =>
        file.excelFiles?.some((excel: any) => {
          const uploaded = new Date(excel.uploadedAt);
          return uploaded >= start && uploaded <= end;
        })
      );

      //  keep only filtered results (no fallback)
      this.filteredFiles = dateFiltered;
    }
  }




  resetDateRange(): void {
    this.digitizedStartDate = null;
    this.digitizedEndDate = null;
    this.showCalendar = false;
    this.showDatePopup = false;
    console.log(' Date range cleared → showing all files');
    this.filteredFiles = [...this.allFilteredFiles];
  }



  // Disable selecting future dates
  disableFutureDates = (d: Date | null): boolean => {
    const date = d || new Date();
    return date <= this.today;
  };

  // Check if date range is valid
  isDateRangeValid(): boolean {
    if (!this.digitizedStartDate || !this.digitizedEndDate) return true;
    return this.digitizedStartDate <= this.digitizedEndDate;
  }



  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    // if click is NOT inside table, clear all highlights
    if (!target.closest('table.afs-table')) {
      this.activeRow = null;
    }
  }



  ngOnInit(): void {
    const token = localStorage.getItem('token');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (!token || !isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.getAFSMetrics();
    this.loadFilters();


    // Load filters when component initializes
  }
  activeRow: any = null;

  setActiveRow(file: any) {
    this.activeRow = file;
  }



  loadFilters() {
    const url = `http://localhost:8080/api/v1/afs-digitization/afs-filters`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) {
          this.filters.states = res.filters.states;
          this.filters.populationCategories = res.filters.populationCategories;
          this.filters.allCities = res.filters.cities; // Store full list
          this.filters.cities = res.filters.cities;     // Default: show all
          this.filters.years = res.filters.years;
          this.filters.documentTypes = res.filters.documentTypes;


          // if (this.filters.years.length > 0) {
          //   this.selectedYear = this.filters.years[0].name;
          // }
        }
      },
      error: (err) => {
        console.error('Failed to load filters:', err);
      }
    });
  }

  filtersApplied = false;

  //filteredFiles: { name: string; url: string }[] = [];
  filteredFiles: {
    [x: string]: any;
    stateName: string;
    cityName: string;
    ulbCode: string;
    fileName: string;
    fileUrl: string;
    statusText?: string;
    ulbSubmit?: string;
    uploadedAt?: string;
    localFile?: File;
    previewUrl?: string;
    pageCount?: number;
    selected?: boolean;
    docType?: string;
    extraFiles?: { fileName: string; fileUrl: string; pageCount?: number; previewUrl?: string; originalFile?: File }[];
    excelFiles?: { _id: string; s3Key: string; fileUrl: string; requestId: string; uploadedAt: string; uploadedBy: string; }[];

  }[] = [];

  hasExcelFile(file: any, uploadedBy: string): boolean {
    return !!file.excelFiles?.some((f: any) => f.uploadedBy === uploadedBy);
  }

  getExcelFiles(file: any, uploadedBy: string) {
    return file.excelFiles?.filter((f: any) => f.uploadedBy === uploadedBy) || [];
  }


  private updateFileName(originalName: string, suffix: string): string {
    if (!originalName) return '';

    // Strip extension
    const parts = originalName.split('.');
    const ext = parts.length > 1 ? '.' + parts.pop() : '';
    const base = parts.join('.');

    // Always remove any old suffix (_ULB_UPLOADED / _AFS_UPLOADED)
    const cleanedBase = base.replace(/_(ULB_UPLOADED|AFS_UPLOADED)$/i, '');

    return `${cleanedBase}_${suffix}.pdf`;
  }



  // async handleFileUpload(event: any, file: any) {
  //   const selectedFile = event.target.files[0];

  //   if (!selectedFile || selectedFile.type !== 'application/pdf') {
  //     alert('Please upload a valid PDF file.');
  //     return;
  //   }

  //   file.localFile = selectedFile;
  //   file.previewUrl = URL.createObjectURL(selectedFile);
  //   // file.fileName = selectedFile.name;
  //    file.fileName = this.updateFileName(selectedFile.name, 'AFS_UPLOADED');

  //   // Extract page count from local file
  //   const arrayBuffer = await selectedFile.arrayBuffer();
  //   const pdfDoc = await PDFDocument.load(arrayBuffer);
  //   file.pageCount = pdfDoc.getPageCount();
  // }
  async handleFileUpload(event: Event, file: any) {
    const input = event.target as HTMLInputElement;
    const selectedFile = input?.files?.[0];

    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }

    this.isLoading = true; //  start loader

    try {
      // extract page count
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      // build formData
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('ulbId', file.ulbId);
      formData.append('financialYear', this.selectedYear);
      formData.append('auditType', this.isAudited ? 'audited' : 'unAudited');

      const docTypeName =
        this.filters.documentTypes
          .flatMap(group => group.items)
          .find(doc => doc.key === this.selectedDocType)?.name || '';
      formData.append('docType', docTypeName);

      const url = `http://localhost:8080/api/v1/afs-digitization/afs-file`;
      const response: any = await this.http.post(url, formData).toPromise();

      if (response.success && response.file?.fileUrl) {
        console.log('File uploaded successfully:', response);

        file.extraFiles = file.extraFiles || [];

        // Replace existing docType entry if found
        const existingIndex = file.extraFiles.findIndex(
          (ef: any) => ef.docType === docTypeName
        );

        const newEntry = {
          docType: docTypeName,
          fileName: this.updateFileName(selectedFile.name, 'AFS_UPLOADED'),
          fileUrl: response.file.fileUrl,
          pageCount
        };

        if (existingIndex >= 0) {
          file.extraFiles[existingIndex] = newEntry; // overwrite
        } else {
          file.extraFiles.push(newEntry); // first-time upload
        }

        file.hasAFS = true; // mark as uploaded
      } else {
        alert('Upload failed: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Upload failed. Please try again.');
    } finally {
      this.isLoading = false; // 👈 stop loader
      this.applyFilters();
    }
  }








  async getPdfPageCount(url: string): Promise<number> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      return pdfDoc.getPageCount();
    } catch (err) {
      console.error('Failed to load PDF for page count:', err);
      return 0;
    }
  }





  @ViewChildren('fileInput') fileInputs!: QueryList<ElementRef<HTMLInputElement>>;

  triggerFileInput(file: any) {
    const identifier = file.cityName + file.ulbCode;
    const inputElement = this.fileInputs.find(ref => ref.nativeElement.getAttribute('data-id') === identifier);
    if (inputElement) {
      inputElement.nativeElement.click();
    }
  }




  storageBaseUrl = environment.STORAGE_BASEURL;



  //for loading cities based on state
  // applyFilters() {
  //   this.filtersApplied = true;
  //   this.filteredFiles = [];

  //   const baseUrl = 'http://localhost:8080/api/v1/ledger/ulb-financial-data/files';
  //   const financialYear = this.selectedYear;
  //   const auditType = this.isAudited ? 'audited' : 'unAudited';

  //   //const selectedDocName = this.filters.documentTypes.find(d => d.key === this.selectedDocType)?.name || '';
  //   const selectedDocName =
  //   this.filters.documentTypes
  //     .flatMap(group => group.items)
  //     .find(doc => doc.key === this.selectedDocType)?.name || '';


  //   const requests = this.selectedCities.map(cityName => {
  //     const city = this.filters.allCities.find(c => c.name === cityName);
  //     if (!city) return of([]); // if city not found, skip it

  //     const stateName = this.filters.states.find(s => s._id === city.stateId)?.name || '';

  //     const url = `${baseUrl}/${city._id}?financialYear=${financialYear}&auditType=${auditType}`;

  //     return this.http.get<any>(url).pipe(
  //       map(res => {
  //         const matchedPdfs = (res.success && res.data.pdf)
  //           ? res.data.pdf.filter((file: any) => file.name?.trim() === selectedDocName?.trim())
  //           : [];

  //         if (!matchedPdfs || matchedPdfs.length === 0) {
  //           // return fallback row
  //           return [{
  //             stateName,
  //             cityName: city.name,
  //             ulbCode: city.code || '',
  //             fileName: 'No data available',
  //             fileUrl: ''
  //           }];
  //         }

  //         // return real files
  //         return matchedPdfs.map((file: any) => ({
  //           stateName,
  //           cityName: city.name,
  //           ulbCode: city.code || '',
  //           fileName: file.name,
  //           fileUrl: file.url,
  //           timestamp: res.timestamp


  //         }));
  //       }),
  //       catchError(err => {
  //         // also return fallback row if API fails
  //         return of([{
  //           stateName,
  //           cityName: city.name,
  //           ulbCode: city.code || '',
  //           fileName: 'Error loading data',
  //           fileUrl: ''
  //         }]);
  //       })
  //     );
  //   });

  //   forkJoin(requests).subscribe((results: any[]) => {
  //     this.filteredFiles = results.flat()
  //     .filter(file => file.fileName !== 'No data available' && file.fileName !== 'Error loading data');

  //     this.filteredFiles.forEach(file => {
  //   if (file.fileUrl) {
  //     const fullUrl = this.storageBaseUrl + file.fileUrl;
  //     this.getPdfPageCount(fullUrl).then(pageCount => {
  //       file.pageCount = pageCount;
  //     });
  //   }
  // });
  // });
  // }



  applyFilters() {

    if (!this.selectedState) {
      alert("⚠️ Please select a state");   // simple browser popup
      return;
    }
    if (!this.selectedPopulation) {
      alert("⚠️ Please select a population category");   // simple browser popup
      return;
    }
    if (!this.selectedYear) {
      alert("⚠️ Please select a year");   // simple browser popup
      return;
    }
    if (!this.selectedDocType) {
      alert("⚠️ Please select Document type");   // simple browser popup
      return;
    }
    if (this.selectedDocType !== '16th_fc' && !this.isAudited) {
      alert("⚠️ Please select Audit Status");
      return;
    }
    this.filtersApplied = true;
    this.filteredFiles = [];
    this.isLoading = true;   // 👈 start loader



    const baseUrl = 'http://localhost:8080/api/v1/ledger/ulb-financial-data/files';
    const statusUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-form-status-by-ulb';
    const afsUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-file';
    const excelUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-excel-file';

    const financialYear = this.selectedYear;
    const auditType = this.isAudited;

    const selectedDocName =
      this.filters.documentTypes
        .flatMap(group => group.items)
        .find(doc => doc.key === this.selectedDocType)?.name || '';

    const requests = this.selectedCities.map(cityName => {
      const city = this.filters.allCities.find(c => c.name === cityName);
      if (!city) return of([]);

      const stateName = this.filters.states.find(s => s._id === city.stateId)?.name || '';

      const fileUrl = `${baseUrl}/${city._id}?financialYear=${financialYear}&auditType=${auditType}`;
      const statusUrl = `${statusUrlBase}/${city._id}?financialYear=${financialYear}&auditType=${auditType}`;
      const afsUrl = `${afsUrlBase}?ulbId=${city._id}&financialYear=${financialYear}&auditType=${auditType}&docType=${encodeURIComponent(selectedDocName)}`;
      const excelUrl = `${excelUrlBase}?ulbId=${city._id}&financialYear=${financialYear}&auditType=${auditType}&docType=${encodeURIComponent(selectedDocName)}`;

      return forkJoin({
        files: this.http.get<any>(fileUrl).pipe(catchError(() => of(null))),
        status: this.http.get<any>(statusUrl).pipe(catchError(() => of(null))),
        afs: this.http.get<any>(afsUrl).pipe(catchError(() => of(null))),
        excel: this.http.get<any>(excelUrl).pipe(catchError(() => of(null)))
      }).pipe(
        map(({ files, status, afs, excel }) => {
          const matchedPdfs = (files?.success && files.data?.pdf)
            ? files.data.pdf.filter((f: any) => f.name?.trim() === selectedDocName?.trim())
            : [];

          const statusText = status?.data?.statusText || 'No Status';
          const ulbSubmit = status?.data?.ulbSubmit || null;

          if (!matchedPdfs || matchedPdfs.length === 0) {
            return [{
              stateName,
              cityName: city.name,
              ulbCode: city.code || '',
              ulbId: city._id,
              fileName: 'No data available',
              fileUrl: '',
              statusText,
              ulbSubmit,
              excelFiles: excel?.fileGroup?.files || []
            }];
          }

          const rows = matchedPdfs.map((file: any) => ({
            stateName,
            cityName: city.name,
            ulbCode: city.code || '',
            ulbId: city._id,
            fileName: this.updateFileName(file.name, 'ULB_UPLOADED'),
            fileUrl: file.url,
            timestamp: files.timestamp,
            statusText,
            ulbSubmit,
            extraFiles: [] as any[],
            excelFiles: (excel?.fileGroup?.files || []).map((f: any) => ({
              _id: f._id,
              s3Key: f.s3Key,
              fileUrl: f.fileUrl,
              requestId: f.requestId,   // 👈 add requestId
              uploadedAt: f.uploadedAt,
              uploadedBy: f.uploadedBy
            }))

          }));

          if (afs?.success && afs.file?.fileUrl) {
            rows.forEach((r: any) => {
              r.extraFiles.push({
                fileName: this.updateFileName(afs.file.docType || 'afs.pdf', 'AFS_UPLOADED'),
                fileUrl: afs.file.fileUrl,
                uploadedAt: afs.file.uploadedAt
              });
              r.uploadedAt = afs.file.uploadedAt;
            });
          }

          return rows;
        })
      );
    });

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        let mergedFiles = results.flat()
          .filter((file: any) => file.fileName !== 'No data available' && file.fileName !== 'Error loading data');
        this.allFilteredFiles = mergedFiles;   // backup copy
        this.filteredFiles = [...mergedFiles]; // working copy for display


        this.filteredFiles = mergedFiles;




        this.filteredFiles.forEach(file => {
          if (file.fileUrl) {
            const fullUrl = this.storageBaseUrl + file.fileUrl;
            this.getPdfPageCount(fullUrl).then(pageCount => {
              file.pageCount = pageCount;
            });
          }

          if (file.extraFiles?.length) {
            file.extraFiles.forEach((ef: any) => {
              const fullUrl = ef.fileUrl;
              this.getPdfPageCount(fullUrl).then(pageCount => {
                ef.pageCount = pageCount;
              });
            });
          }
        });
      },
      error: (err) => {
        console.error('Error fetching data:', err);
      },
      complete: () => {
        this.isLoading = false;   // 👈 stop loader
      }
    });
  }


  showUploadedDatePopup = false;
  uploadedStartDate: Date | null = null;
  uploadedEndDate: Date | null = null;
  openUploadedDatePopup() {
    this.showUploadedDatePopup = true;
  }

  closeUploadedDatePopup() {
    this.showUploadedDatePopup = false;
  }

  applyUploadedDateRange(): void {
    if (!this.uploadedStartDate || !this.uploadedEndDate) {
      alert("⚠️ Please select both start and end dates");
      return;
    }

    if (!this.isUploadedDateRangeValid()) {
      alert("⚠️ Start date cannot be after End date");
      return;
    }

    this.showUploadedDatePopup = false;

    // ✅ Parse picker date (DD-MM-YYYY or Date)
    const parsePickerDate = (val: string | Date): Date => {
      if (val instanceof Date) return val;
      val = val.replace(/[\/.]/g, "-").trim();
      const parts = val.split("-");
      if (parts.length === 3) {
        const [p1, p2, p3] = parts.map(Number);
        const isDDMMYYYY = p1 > 12;
        const day = isDDMMYYYY ? p1 : p2;
        const month = isDDMMYYYY ? p2 : p1;
        const year = p3 < 100 ? 2000 + p3 : p3;
        return new Date(year, month - 1, day);
      }
      return new Date(val);
    };

    const start = parsePickerDate(this.uploadedStartDate);
    const end = parsePickerDate(this.uploadedEndDate);
    end.setHours(23, 59, 59, 999);

    console.log("📅 Selected range:", start, "→", end);

    // ✅ Parse file date like "10/5/24, 3:56 PM,"
    const parseFileDate = (value: string): Date | null => {
      if (!value) return null;
      value = value.trim().replace(/,+$/, "").replace(/^\D*0+/, "").replace(/\s{2,}/g, " ");
      const direct = new Date(value);
      if (!isNaN(direct.getTime())) return direct;

      const match = value.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i
      );
      if (match) {
        let [, m, d, y, h, min, ampm] = match;
        let year = parseInt(y, 10);
        if (year < 100) year += 2000;
        let hour = parseInt(h, 10);
        if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
        if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        return new Date(year, parseInt(m) - 1, parseInt(d), hour, parseInt(min));
      }
      console.warn("⚠️ Unrecognized date format:", value);
      return null;
    };

    const inRange = (val: string): boolean => {
      const d = parseFileDate(val);
      console.log("🕓 Checking:", val, "→ Parsed:", d);
      if (!d) return false;
      const isWithin = d >= start && d <= end;
      console.log(`🧩 ${val} → ${d.toLocaleString()} → in range? ${isWithin}`);
      return isWithin;
    };

    const dateFiltered = this.allFilteredFiles.filter((file: any) => {
      if (file.uploadedAt && inRange(file.uploadedAt)) return true;
      if (file.extraFiles?.some((ef: any) => inRange(ef.uploadedAt))) return true;
      if (file.excelFiles?.some((ef: any) => inRange(ef.uploadedAt))) return true;
      return false;
    });

    this.filteredFiles = dateFiltered;

    console.log("✅ Matched count:", this.filteredFiles.length);
  }






  resetUploadedDateRange(): void {
    this.uploadedStartDate = null;
    this.uploadedEndDate = null;
    this.showUploadedDatePopup = false;
    this.filteredFiles = [...this.allFilteredFiles];
    console.log('Uploaded date range cleared → showing all files');
  }

  isUploadedDateRangeValid(): boolean {
    if (!this.uploadedStartDate || !this.uploadedEndDate) return true;
    return this.uploadedStartDate <= this.uploadedEndDate;
  }



  resetFilters() {
    this.selectedState = '';
    this.stateSearchText = '';
    this.stateDropdownOpen = false;
    this.selectedPopulation = '';
    this.selectedCities = [];
    this.selectedYear = '';
    this.selectedDocType = '';
    this.isAudited = null;
    this.uploadedStartDate = null;
    this.uploadedEndDate = null;


    this.digitizedStartDate = null;
    this.digitizedEndDate = null;

    // this.filteredFiles = [];
    // this.allFilteredFiles = [];
    this.filtersApplied = false;
  }


  toggleCitySelection(city: string, isChecked: boolean) {
    if (isChecked) {
      if (!this.selectedCities.includes(city)) {
        this.selectedCities.push(city);
      }
    } else {
      this.selectedCities = this.selectedCities.filter(c => c !== city);
    }
  }
  onPopulationCategoryChange() {
    if (this.selectedPopulation === 'All') {
      this.filters.cities = this.filters.allCities;
    } else {
      this.filters.cities = this.filters.allCities.filter(
        city => city.populationCategory === this.selectedPopulation
      );
    }

    // Optionally reset selectedCities if they are not part of the filtered list
    this.selectedCities = this.selectedCities.filter(city =>
      this.filters.cities.some(c => c.name === city)
    );
  }


  tableData: any[] = []; // your full table data

  sortByCity(order: 'asc' | 'desc') {
    this.filteredFiles.sort((a, b) => {
      const cityA = a.cityName?.toLowerCase() || '';
      const cityB = b.cityName?.toLowerCase() || '';

      if (order === 'asc') {
        return cityA.localeCompare(cityB);
      } else {
        return cityB.localeCompare(cityA);
      }
    });
  }

  sortByULBCode(order: 'asc' | 'desc') {
    this.filteredFiles.sort((a, b) => {
      const codeA = a.ulbCode?.toLowerCase() || '';
      const codeB = b.ulbCode?.toLowerCase() || '';

      if (order === 'asc') {
        return codeA.localeCompare(codeB);
      } else {
        return codeB.localeCompare(codeA);
      }
    });
  }



  onPopulationOrStateChange() {
    const selectedState = this.selectedState;
    const selectedPop = this.selectedPopulation;

    // Filter all cities of the selected state
    const stateCities = this.filters.allCities.filter(city =>
      !selectedState || city.stateId === selectedState
    );

    // Cities that match both state and population category
    const matchingCities = selectedPop === 'All'
      ? stateCities
      : stateCities.filter(city => city.populationCategory === selectedPop);

    // Cities from the state that do NOT match the selected population category
    const nonMatchingCities = selectedPop === 'All'
      ? []
      : stateCities.filter(city => city.populationCategory !== selectedPop);

    // Merge: matching cities (checked) first, then non-matching (unchecked)
    this.filters.cities = [...matchingCities, ...nonMatchingCities];

    // Update selectedCities with matching ones only (autocheck them)
    this.selectedCities = matchingCities.map(c => c.name);
  }

  //for loading cities based on state
  // onPopulationOrStateChange() {
  //   const selectedPop = this.selectedPopulation;

  //   const matchingCities = selectedPop === 'All' 
  //     ? this.filters.allCities 
  //     : this.filters.allCities.filter(city => city.populationCategory === selectedPop);

  //   const nonMatchingCities = selectedPop === 'All'
  //     ? []
  //     : this.filters.allCities.filter(city => city.populationCategory !== selectedPop);

  //   this.filters.cities = [...matchingCities, ...nonMatchingCities];
  //   this.selectedCities = matchingCities.map(c => c.name);
  // }


  citySearchText = '';

  get filteredCities() {
    let cities = this.filters.cities;

    // Apply search text filtering
    if (this.citySearchText.trim()) {
      const search = this.citySearchText.toLowerCase();
      cities = cities.filter(city =>
        city.name.toLowerCase().includes(search)
      );
    }

    // Sort: selected cities first, then others
    return [...cities].sort((a, b) => {
      const aSelected = this.selectedCities.includes(a.name);
      const bSelected = this.selectedCities.includes(b.name);
      return (aSelected === bSelected) ? 0 : (aSelected ? -1 : 1);
    });
  }



  stateSearchText = '';
  stateDropdownOpen = false;

  get filteredStates() {
    if (!this.stateSearchText.trim()) {
      return this.filters.states;
    }

    const search = this.stateSearchText.toLowerCase();
    return this.filters.states.filter(state =>
      state.name.toLowerCase().includes(search)
    );
  }
  selectState(state: any) {
    this.selectedState = state._id;
    this.stateSearchText = state.name; // display selected name
    this.onPopulationOrStateChange();
    this.stateDropdownOpen = false;


    //for loading cities based on state
    // Call backend again to load cities for selected state
    // const url = `http://localhost:8080/api/v1/afs-digitization/afs-filters?stateId=${this.selectedState}`;
    // this.http.get<any>(url).subscribe({
    //   next: (res) => {
    //     if (res.success) {
    //       this.filters.cities = res.filters.cities;
    //       this.filters.allCities = res.filters.cities; // update master list
    //       this.filters.populationCategories = res.filters.populationCategories;
    //       this.onPopulationOrStateChange();
    //     }
    //   },
    //   error: (err) => {
    //     console.error('Failed to load state-specific cities:', err);
    //   }
    // });

  }




  togglePopup() {
    this.showPopup = !this.showPopup;
  }
  toggleMetricsPopup() {
    this.showMetricsPopup = !this.showMetricsPopup;
  }

  //   getUserSuccessRate(): number {
  //   const total = this.userMetrics.digitizedFiles + this.userMetrics.failedFiles;
  //   if (total === 0) return 0;
  //   return Math.round((this.userMetrics.digitizedFiles / total) * 100);
  // }

  getGlobalSuccessRate(): number {
    const total = this.globalMetrics.digitizedFiles + this.globalMetrics.failedFiles;
    if (total === 0) return 0;
    return Math.round((this.globalMetrics.digitizedFiles / total) * 100);
  }


  logout() {
    localStorage.clear();
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/login']);
    });
  }

  onDocTypeChange(selectedKey: string) {
    this.selectedDocType = selectedKey;

    // Auto-check "Audited" if selected document is 16th_fc
    if (selectedKey === '16th_fc') {
      this.isAudited = 'audited';   // 👈 force audited
    } else {
      this.isAudited = null;        // 👈 clear so user must select
    }
  }


  getAFSMetrics() {
    const url = `http://localhost:8080/api/v1/afs-digitization/afs-metrics`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) {
          //this.userMetrics = res.user;
          this.globalMetrics = res.global;
        }
      },
      error: (err) => {
        console.error('Error fetching metrics:', err);
      }
    });
  }

  downloadExcel() {
    const STORAGE_BASEURL = 'https://jana-cityfinance-live.s3.ap-south-1.amazonaws.com';

    const exportData: any[] = this.filteredFiles.map(file => {
      const excelFile = file.excelFiles?.[0];

      return {
        State: file.stateName,
        City: file.cityName,
        'ULB Code': file.ulbCode,
        Year: this.selectedYear || 'N/A',   // ✅ Added Year column
        'PDF Document': file.fileName,      // clickable later
        'Form Status': file.statusText,
        'Digitize Status': this.hasExcelFile(file, 'ULB') ? 'DIGITIZED' : 'NOT DIGITIZED', // clickable later
        'Form Uploaded On': file.ulbSubmit ? new Date(file.ulbSubmit).toLocaleString() : 'Not Submitted',
        'Form Digitized On': excelFile?.uploadedAt ? new Date(excelFile.uploadedAt).toLocaleString() : 'N/A',
        'Request ID': excelFile?.requestId || 'N/A',
        'Page Count': file.pageCount || 'N/A'
      };
    });

    // Convert to worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);

    // Find column indexes dynamically
    const headers = Object.keys(exportData[0] || {});
    const pdfCol = headers.indexOf('PDF Document') + 1;       // e.g. 5
    const digitizeCol = headers.indexOf('Digitize Status') + 1; // e.g. 7

    // Inject HYPERLINK formulas into "PDF Document" and "Digitize Status"
    exportData.forEach((row, rowIndex) => {
      const excelRow = rowIndex + 2; // row 1 = headers
      const file = this.filteredFiles[rowIndex];

      // PDF Document hyperlink
      if (file.fileUrl) {
        const pdfUrl = `${STORAGE_BASEURL}${file.fileUrl.startsWith('/') ? '' : '/'}${file.fileUrl}`;
        const pdfColLetter = XLSX.utils.encode_col(pdfCol - 1);
        ws[`${pdfColLetter}${excelRow}`] = {
          t: 's',
          f: `HYPERLINK("${pdfUrl}", "${row['PDF Document']}")`
        };
      }

      // Digitize Status hyperlink
      const excelFile = file.excelFiles?.[0];
      const digitizeColLetter = XLSX.utils.encode_col(digitizeCol - 1);
      if (excelFile?.fileUrl) {
        ws[`${digitizeColLetter}${excelRow}`] = {
          t: 's',
          f: `HYPERLINK("${excelFile.fileUrl}", "DIGITIZED")`
        };
      } else {
        ws[`${digitizeColLetter}${excelRow}`] = { t: 's', v: 'NOT DIGITIZED' };
      }
    });

    // Auto column widths
    const colWidths = headers.map(key => ({
      wch: Math.max(key.length, ...exportData.map(r => String(r[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;

    // Create workbook
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Files');

    // Export
    const excelBuffer: any = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data: Blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });
    saveAs(data, `AvailableFiles_${new Date().toISOString().split('T')[0]}.xlsx`);
  }



  selectAll = false;
  selectedFilesCount = 0;
  totalSelectedPages = 0;

  updateSelection() {
    const selectedFiles = this.filteredFiles.filter(f => f.selected);

    let fileCount = 0;
    let pageCount = 0;

    selectedFiles.forEach(f => {
      // count main file
      if (f.pageCount) {
        pageCount += f.pageCount;
        fileCount += 1;
      }

      // count extra uploaded files
      if (f.extraFiles?.length) {
        f.extraFiles.forEach((ef: any) => {
          if (ef.pageCount) {
            pageCount += ef.pageCount;
            fileCount += 1;
          }
        });
      }
    });

    this.selectedFilesCount = fileCount;
    this.totalSelectedPages = pageCount;

    // Update "select all" state
    this.selectAll = selectedFiles.length === this.filteredFiles.length;
  }


  toggleSelectAll() {
    this.filteredFiles.forEach(f => (f.selected = this.selectAll));
    this.updateSelection();

    this.activeRow = null;
  }


  showDigitizePopup = false;
  digitizeStatus: string = '';

  openDigitizePopup() {
    this.showDigitizePopup = true;
    this.digitizeStatus = '';
  }

  closeDigitizePopup() {
    this.showDigitizePopup = false;
    this.digitizeStatus = '';
  }


  // private async fetchPdfAsBlob(url: string): Promise<Blob> {
  //   const response = await fetch(this.storageBaseUrl + url);
  //   return await response.blob();
  // }
  private async fetchPdfAsBlob(url: string): Promise<Blob> {
    if (!url) {
      throw new Error("Invalid file URL");
    }

    let fullUrl = url.trim();

    //  Fix malformed URLs like "https//"
    if (fullUrl.startsWith("https//")) {
      fullUrl = fullUrl.replace("https//", "https://");
    }

    //  Only prefix storageBaseUrl if the URL is relative (starts with "/")
    if (fullUrl.startsWith("/")) {
      fullUrl = this.storageBaseUrl + fullUrl;
    }

    console.log(" Fetching PDF from:", fullUrl);

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    return await response.blob();
  }





  private async fetchExcelAsBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch Excel: ${response.status}`);
    return await response.blob();
  }


  // async proceedDigitization() {
  //   if (this.selectedFilesCount === 0) return;

  //   this.digitizeStatus = 'processing';

  //   for (const fileRow of this.filteredFiles.filter(f => f.selected)) {
  //     try {
  //       const excelLinks: any[] = [];

  //       // loop over ULB + AFS pdfs if exist
  //       const pdfFiles = [fileRow, ...(fileRow.extraFiles || [])];

  //       for (const pdf of pdfFiles) {
  //         if (!pdf.fileUrl && !pdf.previewUrl && !pdf.originalFile) continue;

  //         const formData = new FormData();

  //         if (pdf.originalFile) {
  //           // Case 1: user uploaded, you already have a File
  //           formData.append("file", pdf.originalFile, pdf.originalFile.name);
  //         } else {
  //           // Case 2: only have a URL → fetch as blob and give filename
  //           const blob = await this.fetchPdfAsBlob(pdf.fileUrl || pdf.previewUrl || '');
  //           formData.append("file", blob, "document.pdf");
  //         }

  //         const docTypeName =
  //           this.filters.documentTypes
  //             .flatMap(group => group.items)
  //             .find(doc => doc.key === this.selectedDocType)?.name || '';

  //         formData.append("Document_type_ID", fileRow.docType || "bal_sheet");

  //         const digitizeResp: any = await this.http.post(
  //           "http://3.109.105.81/AFS_Digitization",
  //           formData
  //         ).toPromise();
  //         if (digitizeResp?.message) {
  //           alert(digitizeResp.message);
  //         }

  //         if (digitizeResp?.S3_Excel_Storage_Link) {
  //           //  Push object instead of raw string
  //           excelLinks.push({
  //             url: digitizeResp.S3_Excel_Storage_Link,
  //             requestId: digitizeResp.request_id
  //           });

  //         }
  //       }



  //       // Now upload collected excel links to your backend
  //       if (excelLinks.length > 0) {
  //         console.log("Excel links found:", excelLinks);
  //         const backendForm = new FormData();
  //         backendForm.append('ulbId', fileRow['ulbId']);
  //         backendForm.append('financialYear', this.selectedYear);
  //         backendForm.append('auditType', this.isAudited ?? '');

  //         const docTypeName =
  //           this.filters.documentTypes
  //             .flatMap(group => group.items)
  //             .find(doc => doc.key === this.selectedDocType)?.name || '';

  //         backendForm.append('docType', docTypeName);

  //         //  stringify each link before appending
  //         for (let i = 0; i < excelLinks.length; i++) {
  //           backendForm.append('excelLinks', JSON.stringify(excelLinks[i]));
  //         }

  //         console.log("Ready to hit backend API...");
  //         console.log("Uploading to backend with formData:", {
  //           ulbId: fileRow['ulbId'],
  //           financialYear: this.selectedYear,
  //           auditType: this.isAudited,
  //           docType: docTypeName,
  //           excelFiles: excelLinks
  //         });

  //         try {
  //           const resp = await this.http.post(
  //             'http://localhost:8080/api/v1/afs-digitization/afs-excel-file',
  //             backendForm
  //           ).toPromise();
  //           console.log("Backend upload response:", resp);
  //         } catch (e) {
  //           console.error("Backend upload failed:", e);
  //         }
  //       }

  //       console.log('Row processed successfully:', fileRow['ulbId']);

  //     } catch (err) {
  //       console.error('Error digitizing row', fileRow['ulbId'], err);
  //     }
  //   }

  //   this.digitizeStatus = 'done';
  //   if (this.digitizeStatus === 'done') {
  //     this.applyFilters();
  //   }
  // }


  async proceedDigitization() {
  if (this.selectedFilesCount === 0) return;

  this.digitizeStatus = 'processing';

  for (const fileRow of this.filteredFiles.filter(f => f.selected)) {
    try {
      const excelLinks: any[] = [];

      // Combine ULB + AFS PDFs
      const pdfFiles = [fileRow, ...(fileRow.extraFiles || [])];

      for (const pdf of pdfFiles) {
        if (!pdf.fileUrl && !pdf.previewUrl && !pdf.originalFile) continue;

        const formData = new FormData();

        // Prepare file blob
        if (pdf.originalFile) {
          formData.append("file", pdf.originalFile, pdf.originalFile.name);
        } else {
          const blob = await this.fetchPdfAsBlob(pdf.fileUrl || pdf.previewUrl || '');
          formData.append("file", blob, "document.pdf");
        }

        const sourceType = pdf === fileRow ? 'ULB' : 'AFS';
        formData.append("Document_type_ID", fileRow.docType || "bal_sheet");

        let digitizeResp: any;
        try {
          digitizeResp = await this.http.post(
            "http://3.109.105.81/AFS_Digitization",
            formData
          ).toPromise();
        } catch (error: any) {
          digitizeResp = error?.error || {};
          console.warn(`⚠️ ${sourceType} Digitization failed:`, digitizeResp);
        }

        console.log(`📄 ${sourceType} Digitization API Response:`, digitizeResp);

        // === CASE 1: Excel successfully generated ===
        if (digitizeResp?.S3_Excel_Storage_Link) {
          excelLinks.push({
            url: digitizeResp.S3_Excel_Storage_Link,
            requestId: digitizeResp.request_id,
            source: sourceType
          });
        }

        // === CASE 2: Failed but has requestId — save request only ===
        else if (digitizeResp?.request_id) {
          const metaBody = {
            ulbId: fileRow['ulbId'],
            financialYear: this.selectedYear,
            auditType: this.isAudited ?? '',
            docType: this.filters.documentTypes
              .flatMap(group => group.items)
              .find(doc => doc.key === this.selectedDocType)?.name || '',
            requestIds: [digitizeResp.request_id],
            failedSource: sourceType
          };

          console.log(`💾 Saving failed ${sourceType} requestId:`, metaBody);

          await this.http.post(
            'http://localhost:8080/api/v1/afs-digitization/save-request-only',
            metaBody
          ).toPromise();

          console.log(`✅ Saved failed ${sourceType} requestId for ${fileRow['ulbId']}`);
        }
      }

      // === Upload successful Excel(s) (if any) ===
      if (excelLinks.length > 0) {
        const backendForm = new FormData();
        backendForm.append('ulbId', fileRow['ulbId']);
        backendForm.append('financialYear', this.selectedYear);
        backendForm.append('auditType', this.isAudited ?? '');

        const docTypeName =
          this.filters.documentTypes
            .flatMap(group => group.items)
            .find(doc => doc.key === this.selectedDocType)?.name || '';
        backendForm.append('docType', docTypeName);

        for (const excel of excelLinks) {
          backendForm.append('excelLinks', JSON.stringify(excel));
        }

        await this.http.post(
          'http://localhost:8080/api/v1/afs-digitization/afs-excel-file',
          backendForm
        ).toPromise();

        console.log(`✅ Uploaded ${excelLinks.length} Excel(s) for ${fileRow['ulbId']}`);
      }

      console.log('Row processed successfully:', fileRow['ulbId']);
    } catch (err) {
      console.error('❌ Error digitizing row', fileRow['ulbId'], err);
    }
  }

  this.digitizeStatus = 'done';
  if (this.digitizeStatus === 'done') {
    this.applyFilters();
  }
}





  showLogsPopup = false;
  selectedRequestId: string | null = null;
  logsData: any = null;

  openLogs(requestId: string) {


    //  if (this.showLogsPopup && this.selectedRequestId === requestId) {
    //   this.closeLogs();
    //   return;
    // }
    this.showLogsPopup = true;
    this.selectedRequestId = requestId;
    this.logsData = null; // reset while loading

    if (!requestId) {
      // No requestId → show empty logs card
      this.logsData = { Message: "No logs available for this file" };
      return;
    }

    const url = `http://localhost:8080/api/v1/afs-digitization/fetchRequestLogs?requestId=${requestId}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success && res.logs.length > 0) {
          this.logsData = res.logs[0];
        } else {
          this.logsData = { Message: "No logs found" };
        }
      },
      error: (err) => {
        console.error("Failed to fetch logs:", err);
        this.logsData = { Message: "Error fetching logs" };
      }
    });

  }

  closeLogs() {
    this.showLogsPopup = false;
    this.selectedRequestId = null;
    this.logsData = null;
  }







}


