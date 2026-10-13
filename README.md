# TedBus

TedBus is a MEAN stack application that replicates the functionalities of the popular bus booking service, RedBus. The application provides users with the ability to search for bus routes, book tickets, and manage their bookings.

## Features

- Search for bus routes
- Book tickets
- Manage bookings
- User authentication and authorization
- Admin panel for managing routes and bookings

## Technologies Used

- **Frontend:**
  - Angular 17.3.0
  - Angular Material 17.3.8
  - RxJS 7.8.0
  - TSLib 2.3.0
  - Zone.js 0.14.3

- **Backend:**
  - Express 4.19.2
  - MongoDB 6.6.2
  - Mongoose 8.4.0
  - Body-Parser 1.20.2
  - CORS 2.8.5

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js and npm installed on your machine
- MongoDB installed and running

## Installation

1. Clone the repository

    ```bash
    git clone https://github.com/yourusername/tedbus.git
    cd tedbus
    ```

### Backend Setup

1. Navigate to the `server` directory

    ```bash
    cd server
    ```

2. Install backend dependencies

    ```bash
    npm install
    ```

3. Start the backend server

    ```bash
    npm start
    ```

The backend server will run on `http://localhost:5000`.

### Frontend Setup

1. Navigate to the `client` directory

    ```bash
    cd frontend
    ```

2. Install frontend dependencies

    ```bash
    npm install
    ```

3. Start the frontend development server

    ```bash
    ng serve
    ```

The frontend server will run on `http://localhost:4200`.

## Usage

1. Open your browser and navigate to `http://localhost:4200`.
2. Use the application to search for bus routes, book tickets, and manage your bookings.

## Contributing

To contribute to TedBus, follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-name`)
3. Make your changes and commit them (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature-name`)
5. Create a new Pull Request

## Contact

If you want to contact me, you can reach me at [girishmaharana42@gmail.com ].

## Acknowledgments

- [RedBus](https://www.redbus.in/) for the inspiration.

---

### Installing Angular Packages

To install the Angular packages, run the following command in the `client` directory:

```bash
npm install @angular/animations@^17.3.0 @angular/cdk@^17.3.8 @angular/common@^17.3.0 @angular/compiler@^17.3.0 @angular/core@^17.3.0 @angular/forms@^17.3.0 @angular/material@^17.3.8 @angular/platform-browser@^17.3.0 @angular/platform-browser-dynamic@^17.3.0 @angular/router@^17.3.0 rxjs@~7.8.0 tslib@^2.3.0 zone.js@~0.14.3
