import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AnalisisDatos } from './analisis-datos';
import { AnalisisDatosService } from './analisis-datos.service';

describe('AnalisisDatos', () => {
  let component: AnalisisDatos;
  let fixture: ComponentFixture<AnalisisDatos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalisisDatos],
      providers: [
        {
          provide: AnalisisDatosService,
          useValue: {
            getColegios: () => of([]),
            getEmpresas: () => of([]),
            getVenues: () => of([]),
            getDifusiones: () => of([]),
            getTareas: () => of([]),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalisisDatos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
