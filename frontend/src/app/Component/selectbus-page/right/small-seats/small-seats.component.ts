import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-small-seats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './small-seats.component.html',
  styleUrl: './small-seats.component.css',
})
export class SmallSeatsComponent {
  @Input() seatno: number = 0;
  @Input() alreadybookedseats: number[] = [];
  @Input() selectedseats: number[] = [];
  @Output() seatselected: EventEmitter<number> = new EventEmitter<number>();

  getcolor(seatno: number): string {
    if (this.selectedseats.includes(seatno)) {
      return 'blue';
    } else if (this.alreadybookedseats.includes(seatno)) {
      return 'red';
    } else {
      return 'black';
    }
  }

  onclick(): void {
    this.seatselected.emit(this.seatno);
  }

  handleselectedseats(seatno: number): void {
    console.log(this.alreadybookedseats);
    console.log('selected seat:', seatno);
  }

  handleseatbooking(seatno: number) {
    if (!this.alreadybookedseats.includes(this.seatno)) {
      if (this.selectedseats.includes(this.seatno)) {
        const seatindex = this.selectedseats.indexOf(seatno);
        this.selectedseats.splice(seatindex, 1);
      } else {
        this.selectedseats.push(this.seatno);
      }
    } else {
      console.log('Seat already booked');
    }
  }
}
