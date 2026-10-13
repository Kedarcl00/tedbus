import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BottomTabComponent } from '../bus-book/bottom-tab/bottom-tab.component';
import { ArrivalTimeService } from '../../../../service/arrival-time.service';

@Component({
  selector: 'app-bus-box',
  standalone: true,
  imports: [CommonModule, MatIconModule, BottomTabComponent],
  templateUrl: './bus-box.component.html',
  styleUrl: './bus-box.component.css',
})
export class BusBoxComponent implements OnInit {
  @Input() rating: number[] = [];
  @Input() operatorname: string = '';
  @Input() bustype: string = '';
  @Input() departuretime: string = '';
  @Input() arrivaltime: string = '';
  @Input() fare: number = 0;           // ← actual fare from DB (per seat)
  @Input() reschedulable: number = 0;
  @Input() livetracking: number = 0;
  @Input() filledseats: any[] = [];
  @Input() routedetails: any;
  @Input() busid: string = '';
  @Input() selecteddate: string = '';

  avgrating: number = 0;
  totalreview: number = 0;
  seatprivce: number = 0;
  bustypename: string = '';
  arrivalTimeDisplay: string = '';
  arrivalIsNextDay: boolean = false;
  busarrivalTimeFormatted: string = '';

  constructor(private arrivalTimeService: ArrivalTimeService) {}

  ngOnInit(): void {
    // --- Rating ---
    const ratings = this.rating || [];
    ratings.forEach((item, index) => {
      this.avgrating += item;
      this.totalreview += index;
    });
    if (this.totalreview === 0) this.totalreview = 1;
    this.avgrating = +(this.avgrating / this.totalreview).toFixed(1);

    // --- Bus type display name ---
    const typeMap: { [key: string]: string } = {
      'AC':      'A/C Seater',
      'non-AC':  'Non-A/C',
      'Sleeper': 'Sleeper',
      'Premium': 'Premium',
    };
    this.bustypename = typeMap[this.bustype] || this.bustype;

    // --- Fare: use DB value directly (already per-seat) ---
    this.seatprivce = this.fare || 0;

    // --- Arrival time ---
    const durationHours = this.parseDurationToHours(this.routedetails?.duration);
    const arrivalResult = this.arrivalTimeService.calculateArrivalTime(
      this.departuretime,
      durationHours,
      this.arrivaltime || undefined
    );
    this.busarrivalTimeFormatted = arrivalResult.time;
    this.arrivalIsNextDay = arrivalResult.nextDay;
    this.arrivalTimeDisplay = this.arrivalTimeService.getDisplayString(
      arrivalResult.time,
      arrivalResult.nextDay
    );
  }

  /**
   * Parse duration string like "10 hours 30 minutes" or "3h 30m" or numeric to decimal hours.
   */
  private parseDurationToHours(duration: any): number {
    if (!duration) return 0;
    if (typeof duration === 'number') return duration;
    const str = String(duration);
    // Matches "10 hours 30 minutes", "10h 30m", "10h", "3 hours"
    const hourMatch = str.match(/(\d+)\s*h(our)?s?/i);
    const minMatch  = str.match(/(\d+)\s*m(in(ute)?s?)?/i);
    const hours   = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const minutes = minMatch  ? parseInt(minMatch[1],  10) : 0;
    return hours + minutes / 60;
  }
}
