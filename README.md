# SneakerMonitor 🏀👟

A Node.js tool to monitor availability of **Puma LaMelo Ball MB.05** (Size 44) in Israeli sneaker stores.

## Features
- Scrapes multiple sites (Factory 54, Terminal X, Foot Locker, etc.)
- Filters for specific model and size.
- Sorts results by price (Low to High).
- Runs automatically on a schedule.

## Prerequisites
- Node.js installed.

## Installation
1. Open a terminal in this directory.
2. Run `npm install` to install dependencies.

## Usage
Run the monitor:
```bash
npm start
```
The monitor will run immediately and then continue checking every X minutes (configurable in code).

## Supported Stores (In Progress)
- Factory 54
- Terminal X
- Foot Locker Israel
