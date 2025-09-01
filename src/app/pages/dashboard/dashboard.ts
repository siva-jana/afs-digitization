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



@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule , FormsModule],
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
  //userMetrics = { digitizedFiles: 0, digitizedPages: 0, failedFiles: 0 ,updatedAt: '' };
  globalMetrics = { digitizedFiles: 0, digitizedPages: 0, failedFiles: 0 ,updatedAt: '' };

  constructor(private router: Router, private http: HttpClient,  ) {}

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
isAudited = false;

@HostListener('document:click', ['$event'])
handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;

  // if click is NOT inside table, clear all highlights
  if (!target.closest('table.afs-table')) {
    this.activeRows.clear();
  }
}



ngOnInit(): void {
  this.getAFSMetrics();
  this.loadFilters(); 
  
  
  // Load filters when component initializes
}
activeRows = new Set<string>();

setActiveRow(file: any) {
  const rowId = file.cityName + file.ulbCode;
  this.activeRows.add(rowId);
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
   localFile?: File;
  previewUrl?: string;
  pageCount?: number;
  selected?: boolean; 
  docType?: string;
   extraFiles?: { fileName: string; fileUrl: string; pageCount?: number }[];
    excelFiles?: { _id: string; s3Key: string; fileUrl: string; uploadedAt: string }[];
 
}[] = [];



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

  try {
    const url = `http://localhost:8080/api/v1/afs-digitization/afs-file`;
    const response: any = await this.http.post(url, formData).toPromise();

    if (response.success && response.file?.fileUrl) {
      console.log('File uploaded successfully:', response);

      file.extraFiles = file.extraFiles || [];

      //  Replace existing docType entry if found
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

      //  Update button state
      file.hasAFS = true;
    } else {
      alert('Upload failed: ' + (response.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error uploading file:', err);
    alert('Upload failed. Please try again.');
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
  this.filtersApplied = true;
  this.filteredFiles = [];

  const baseUrl = 'http://localhost:8080/api/v1/ledger/ulb-financial-data/files';
  const statusUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-form-status-by-ulb';
  const afsUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-file';
  const excelUrlBase = 'http://localhost:8080/api/v1/afs-digitization/afs-excel-file';


  const financialYear = this.selectedYear;
  const auditType = this.isAudited ? 'audited' : 'unAudited';

  // 👇 get docType name from filters
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
    //  include docType in AFS API call
    const afsUrl = `${afsUrlBase}?ulbId=${city._id}&financialYear=${financialYear}&auditType=${auditType}&docType=${encodeURIComponent(selectedDocName)}`;
    const excelUrl = `${excelUrlBase}?ulbId=${city._id}&financialYear=${financialYear}&auditType=${auditType}&docType=${encodeURIComponent(selectedDocName)}`;

    // combine 3 requests now
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

    if (!matchedPdfs || matchedPdfs.length === 0) {
      return [{
        stateName,
        cityName: city.name,
        ulbCode: city.code || '',
        ulbId: city._id,
        fileName: 'No data available',
        fileUrl: '',
        statusText,
        excelFiles: excel?.fileGroup?.files || []   // 👈 attach excel files
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
      extraFiles: [] as any[],
      excelFiles: excel?.fileGroup?.files || []   // 👈 attach excel files
    }));

    // if afs file exists, push into extraFiles array
    if (afs?.success && afs.file?.fileUrl) {
      rows.forEach((r: any) => {
        r.extraFiles.push({
          fileName: this.updateFileName(afs.file.docType || 'afs.pdf', 'AFS_UPLOADED'),
          fileUrl: afs.file.fileUrl
        });
      });
    }

    return rows;
  })
);

  });

  forkJoin(requests).subscribe((results: any[]) => {
    this.filteredFiles = results.flat()
      .filter(file => file.fileName !== 'No data available' && file.fileName !== 'Error loading data');

    this.filteredFiles.forEach(file => {
      if (file.fileUrl) {
        const fullUrl = this.storageBaseUrl + file.fileUrl;
        this.getPdfPageCount(fullUrl).then(pageCount => {
          file.pageCount = pageCount;
        });
      }

      // also count pages for afs extraFiles
      if (file.extraFiles?.length) {
        file.extraFiles.forEach((ef: any) => {
          const fullUrl = ef.fileUrl;
          this.getPdfPageCount(fullUrl).then(pageCount => {
            ef.pageCount = pageCount;
          });
        });
      }
    });
  });
}




resetFilters() {
  this.selectedState ='';
  this.selectedPopulation = '';
  this.selectedCities = [];
  this.selectedYear = '';
  this.selectedDocType = '';
  this.isAudited = false;
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
    this.isAudited = true;
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

  console.log('Download button clicked');
  alert('Download feature coming soon! Will export filtered data as Excel.');
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

proceedDigitization() {
  // Here you can later call backend digitization API
  console.log("Proceeding with digitization for", this.selectedFilesCount, "files");
  
  // Simulate success
  setTimeout(() => {
    this.digitizeStatus = 'done';
  }, 500);
}



}
