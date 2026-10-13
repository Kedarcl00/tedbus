import { Component, Input } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { BusBookingFormComponent } from '../bus-booking-form/bus-booking-form.component';

@Component({
  selector: 'app-form-drawer',
  standalone: true,
  imports: [MatSidenavModule, BusBookingFormComponent],
  templateUrl: './form-drawer.component.html',
  styleUrl: './form-drawer.component.css',
})
export class FormDrawerComponent {
  @Input() selectedseat: number[] = [];
  @Input() seatprice: number = 0;
  @Input() routedetails: any;
  @Input() busid: string = '';
  @Input() busarrivaltime: string = '';   // HH:MM string
  @Input() busdeparturetime: string = ''; // HH:MM string
  @Input() operatorname: string = '';
  @Input() selecteddate: string = '';

  formdrawerstate: boolean = false;
  sidenavopened = false;

  toogledrawer(open: boolean): void {
    this.formdrawerstate = open;
  }
}
