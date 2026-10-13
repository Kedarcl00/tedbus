export interface Bus {
    _id?: string;
    operatorName: string;
    busType: string;
    departureTime: string;
    arrivalTime?: string;
    fare?: number;          // Fare per seat stored in the database
    rating: number[];
    totalSeats?: number;
    routes: string;
    images: string;
    liveTracking: number;
    reschedulable: number;
}
