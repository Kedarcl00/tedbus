import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { RoutePlannerComponent } from './route-planner.component';

describe('RoutePlannerComponent', () => {
  let component: RoutePlannerComponent;
  let fixture: ComponentFixture<RoutePlannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutePlannerComponent, HttpClientTestingModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutePlannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add waypoint', () => {
    const initialLength = component.waypoints.length;
    component.addWaypoint();
    expect(component.waypoints.length).toBe(initialLength + 1);
  });

  it('should remove waypoint', () => {
    component.waypoints = [{ address: 'Test' }];
    component.removeWaypoint(0);
    expect(component.waypoints.length).toBe(0);
  });

  it('should require origin and destination for calculation', () => {
    component.origin = '';
    component.destination = '';
    component.calculateRoute();
    expect(component.errorMessage).toBeTruthy();
  });
});
