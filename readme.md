# 🚀 E-Commerce Performance Engineering: End-to-End Simulation

![JMeter](https://img.shields.io/badge/Apache%20JMeter-5.6.3-D22128?logo=apachejmeter&logoColor=white)
![Status](https://img.shields.io/badge/Status-Stable-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🎯 Overview

This repository hosts a robust performance testing suite designed to simulate high-load user journeys on a standard .NET-based e-commerce platform ([Tricentis Demo Web Shop](https://demowebshop.tricentis.com/)).

The primary goal of this project is to demonstrate **advanced scripting techniques in Apache JMeter**, focusing on dynamic data correlation, session management, and resilient transaction handling within a complex "One Page Checkout" architecture.

## 🏗️ Architecture & Features

Unlike simple record-and-playback scripts, this solution implements a software engineering approach to performance testing:

* **Dynamic Correlation (CSRF Protection):** Implements **CSS Selectors** to extract `__RequestVerificationToken` and session cookies in real-time, ensuring scripts work across different environments and user sessions.
* **Data-Driven Testing:** Decouples test logic from test data using external CSV files (`credenciais.csv`) to simulate thousands of unique users concurrently.
* **Robust Checkout Logic:** Handles complex server-side logic where Shipping addresses must be explicitly provided or inherited from Billing, avoiding common "silent failures" in checkout flows.
* **Dynamic Product Selection:** Uses **Regex Extractors** to identify and select random valid products from search results, preventing bottlenecks on single database rows (hotspots).
* **Business Logic Validation:** Implements **Response Assertions** at every critical step (e.g., verifying "Log out" presence, checking Order History for generated IDs) to avoid false positives (HTTP 200 OK on error pages).

## 🔄 User Journey Flow

The script models a full "Guest-to-Customer" conversion funnel:

```mermaid
graph TD
    A[Login] --> B[Search Product]
    B --> C[Add to Cart]
    C --> D[Checkout Flow]
    D --> E{Transaction Success?}
    E -- Yes --> F[Verify Order History]
    E -- No --> G[Fail Test]
````

1.  **Authentication:** Login with parameterized credentials.
2.  **Discovery:** Search for products (e.g., "Laptop") and parse dynamic IDs.
3.  **Cart Management:** Add items to the shopping cart.
4.  **Checkout Wizard:**
      * Accept Terms.
      * **Billing Address:** Data injection via HTTP POST.
      * **Shipping Address:** Logic to handle distinct or inherited addresses.
      * **Shipping & Payment Methods:** Selection (e.g., Ground / COD).
      * **Confirmation:** Finalizing the order.
5.  **Validation:** Extracting the generated **Order ID** from the customer's order history to ensure database persistence.

## 📂 Project Structure

```text
.
├── tests/
│   └── jmeter/
│       ├── demo-shop-performance.jmx   # Main Test Plan
│       └── data/
│           └── credenciais.csv         # Test Data (Email, Password) - No headers
├── results/                            # Output folder for .csv reports
├── docs/
│   └── architecture_diagram.png
└── README.md
```

## ⚙️ Prerequisites

  * **Java Runtime Environment (JRE):** 8 or higher.
  * **Apache JMeter:** Version 5.6.3 or higher.

## 🚀 How to Run

### 1\. GUI Mode (For Debugging)

1.  Open JMeter.
2.  Load `tests/jmeter/demo-shop-performance.jmx`.
3.  Ensure the CSV path in "CSV Data Set Config" points to `tests/jmeter/data/credenciais.csv`.
4.  Run the test and check the **View Results Tree** listener.

### 2\. CLI Mode (For CI/CD & Load Testing)

To run the test in Non-GUI mode (recommended for load generation) and generate a report:

```bash
jmeter -n -t tests/jmeter/demo-shop-performance.jmx -l results/test_run.csv -e -o results/html_report
```

## 📊 Performance Metrics Strategy

The test plan is configured to calculate throughput based on Little's Law, supporting three load scenarios:

  * **Smoke Test:** Validation of script logic (1-5 users).
  * **Load Test:** 1,000 orders/hour to measure baseline latency.
  * **Stress Test:** 100,000 orders/4 hours to identify breaking points and database locks.

## 🔮 Future Improvements

  * **Migration to k6:** Implementing the same logic in k6 (TypeScript) for better developer experience and lower resource consumption in load generators.
  * **Frontend Performance:** Integrating **Playwright** to measure "Largest Contentful Paint" (LCP) and "Time to Interactive" (TTI) alongside backend stress.
  * **CI/CD Pipeline:** GitHub Actions workflow to trigger smoke tests on every PR.

-----
*Author: Luis Fernando Richter*

