import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewSeatsComponent } from '../../view-seats/view-seats.component';
import { ReviewListComponent } from '../../../../review/review-list.component';

@Component({
  selector: 'app-bottom-tab',
  standalone: true,
  imports: [CommonModule, ViewSeatsComponent, ReviewListComponent],
  templateUrl: './bottom-tab.component.html',
  styleUrl: './bottom-tab.component.css',
})
export class BottomTabComponent {
  @Input() filledseats: number[] = [];
  @Input() seatprice: number = 0;
  @Input() routedetials: any;
  @Input() busarrivaltime: string = '';   // HH:MM string
  @Input() busdeparturetime: string = ''; // HH:MM string
  @Input() operatorname: string = '';
  @Input() busid: string = '';
  @Input() selecteddate: string = '';

  tabstate: boolean[] = [false, false, false, false, false];

  handletabstate(value: number): void {
    for (let i = 0; i < this.tabstate.length; i++) {
      this.tabstate[i] = i === value && !this.tabstate[i];
    }
  }
}
