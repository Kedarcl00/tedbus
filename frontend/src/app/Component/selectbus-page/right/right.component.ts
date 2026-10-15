import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BusService } from '../../../service/bus.service';
import { Bus } from '../../../model/bus.model';
import { Route } from '../../../model/routes.model';
import { SortingBarComponent } from './sorting-bar/sorting-bar.component';
import { BusBoxComponent } from './bus-box/bus-box.component';

@Component({
  selector: 'app-right',
  standalone: true,
  imports: [CommonModule, SortingBarComponent, BusBoxComponent],
  templateUrl: './right.component.html',
  styleUrl: './right.component.css',
})
export class RightComponent implements OnInit {
  matchedbus: Bus[] = [];
  routes: Route[] = [];
  seats: { [key: string]: any } = {};

  departurevar: string = '';
  arrival: string = '';
  date: string = '';

  constructor(private route: ActivatedRoute, private busservice: BusService) {}

  getkeys() {
    return Object.keys(this.seats);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const departure = params['departure'];
      const arrival = params['arrival'];
      const date = params['date'];
      this.departurevar = departure;
      this.arrival = arrival;
      this.date = date;
    });
    this.busservice
      .GETBUSDETAILS(this.departurevar, this.arrival, this.date)
      .subscribe((response: any) => {
        this.matchedbus = response.matchedBuses;
        this.routes = response.route;
        this.seats = response.busidwithseatobj;
      });
  }

  onSortChange(criteria: string): void {
    if (criteria === 'rating') {
      // Sort buses by genuine separate average rating descending (highest first)
      this.matchedbus.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    } else if (criteria === 'fare') {
      this.matchedbus.sort((a, b) => (a.fare ?? 0) - (b.fare ?? 0));
    } else if (criteria === 'departure') {
      this.matchedbus.sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));
    } else if (criteria === 'arrival') {
      this.matchedbus.sort((a, b) => (a.arrivalTime || '').localeCompare(b.arrivalTime || ''));
    } else if (criteria === 'duration') {
      this.matchedbus.sort((a, b) => ((a as any).durationHours || 0) - ((b as any).durationHours || 0));
    } else if (criteria === 'seats') {
      this.matchedbus.sort((a, b) => {
        const aKey = a._id || '';
        const bKey = b._id || '';
        const aAvailable = 40 - (this.seats[aKey]?.length || 0);
        const bAvailable = 40 - (this.seats[bKey]?.length || 0);
        return bAvailable - aAvailable;
      });
    }
  }
}
