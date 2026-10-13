import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-sorting-bar',
  standalone: true,
  imports: [MatIconModule, MatDividerModule],
  templateUrl: './sorting-bar.component.html',
  styleUrl: './sorting-bar.component.css',
})
export class SortingBarComponent {}
