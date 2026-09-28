"use client";
export interface ClockEntry {
  id: string;
  userId: string;
  userName: string;
  clockInTime: Date;
  clockOutTime?: Date;
  clockInLocation?: GeolocationCoordinates;
  clockOutLocation?: GeolocationCoordinates;
  taskDescription?: string;
  photos?: string[];
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface QuickLink {
  id: string;
  title: string;
  description: string;
  icon: string;
  url: string;
  color: string;
}

export interface PerformanceStats {
  daysPresent: number;
  daysAbsent: number;
  hoursWorked: number;
  amountToBePaid: number;
  valueCreated: number;
}

export interface TimeOffRequest {
  startDate: Date;
  endDate: Date;
  reason: string;
  type: 'vacation' | 'sick' | 'personal' | 'other';
}

/** A person who may be assigned to a shift. Derived from Employee + its User link. */
export interface WorkerOption {
  id: string;            // User.id — NOT Employee.id
  name: string;          // REQUIRED. The only name.
  hourlyRate?: number | null;
}
