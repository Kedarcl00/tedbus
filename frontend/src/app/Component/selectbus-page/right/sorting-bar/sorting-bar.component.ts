import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-sorting-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDividerModule],
  templateUrl: './sorting-bar.component.html',
  styleUrl: './sorting-bar.component.css',
})
export class SortingBarComponent {
  @Output() sortChange = new EventEmitter<string>();
  activeSort: string = '';

  handleSort(type: string): void {
    this.activeSort = type;
    this.sortChange.emit(type);
  }
}
