import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Digitization } from './digitization';

describe('Digitization', () => {
  let component: Digitization;
  let fixture: ComponentFixture<Digitization>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Digitization]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Digitization);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
