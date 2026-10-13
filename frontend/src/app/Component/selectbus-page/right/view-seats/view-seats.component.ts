import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { SmallSeatsComponent } from '../small-seats/small-seats.component';
import { FormDrawerComponent } from '../form-drawer/form-drawer.component';

@Component({
  selector: 'app-view-seats',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDividerModule, SmallSeatsComponent, FormDrawerComponent],
  templateUrl: './view-seats.component.html',
  styleUrl: './view-seats.component.css',
})
export class ViewSeatsComponent {
  @Input() filledseats: number[] = [];
  @Input() seatprice: number = 0;
  @Input() routedetails: any;
  @Input() busid: string = '';
  @Input() busarrivaltime: string = '';   // HH:MM string
  @Input() busdeparturetime: string = ''; // HH:MM string
  @Input() operatorname: string = '';
  @Input() selecteddate: string = '';

  selectedseats: number[] = [];
  boardanddrop: boolean = false;

  generatearray(length: number): number[] {
    return Array.from({ length }, (_, index) => index + 1);
  }

  handleselectedseats(seatno: number): void {
    if (this.selectedseats.includes(seatno)) {
      this.selectedseats = this.selectedseats.filter(item => item !== seatno);
    } else {
      this.selectedseats.push(seatno);
    }
  }

  handleboarddrop(): void {
    this.boardanddrop = !this.boardanddrop;
  }
}
