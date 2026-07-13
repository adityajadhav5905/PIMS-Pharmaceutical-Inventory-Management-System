# Medical Inventory Prediction System — Interview Questions & Answers

## Overview

This document contains potential interview questions and answers for the Medical Inventory Prediction System project. It covers architecture, frontend, backend, ML service, database, deployment, security, and general software engineering topics.

---

## 1. Project Architecture

Q: What is the architecture of this project?
A: The project uses a microservice-style architecture with three main services: `client` (React + Vite frontend), `server` (Node.js + Express backend), and `ml-service` (FastAPI prediction service). Data is stored in MongoDB, JWT handles authentication, and Docker Compose can run all services together.

Q: Why was the ML service separated from the backend server?
A: Separating the ML service isolates prediction logic, allows independent scaling, and supports future model upgrades without impacting the API or UI code. It also makes it easier to choose the best runtime stack for each service.

Q: How do the services communicate?
A: The frontend interacts with the backend server via REST API calls. The backend server calls the ML service prediction endpoint to get forecast data. The database operations are handled directly by the backend service with MongoDB.

Q: What are the main advantages of using this architecture?
A: Advantages include modularity, independent deployment, clear separation of concerns, easier testing, and the ability to scale the frontend, API, and ML service separately.

---

## 2. Frontend (client)

Q: What frontend stack does this project use?
A: The frontend is built with React, Vite, Tailwind CSS, and Redux Toolkit. It also uses React Query for server state and API integration.

Q: How does the frontend manage application state?
A: Global state is managed with Redux Toolkit, and asynchronous data fetching is handled through React Query. Local component state is managed with React hooks.

Q: Why use Vite instead of Create React App?
A: Vite provides faster cold starts, improved HMR performance, and supports modern ES modules out of the box. It is a lightweight build system ideal for fast front-end development.

Q: How are protected routes implemented?
A: Protected routes use a `ProtectedRoute` component that checks authentication status, likely via JWT token presence or user state, and redirects unauthenticated users to the login page.

Q: What UI library or styling approach is used?
A: Tailwind CSS is used for styling and responsive layout. The project also organizes reusable UI components under `client/src/components/ui`.

---

## 3. Backend (server)

Q: What is the backend technology stack?
A: The backend uses Node.js with Express, MongoDB as the database, and JWT for authentication. It includes validation middleware, error handling, and background alert jobs.

Q: How is authentication handled?
A: Authentication is implemented with JWT tokens. The backend creates tokens after successful login and protects routes with middleware that validates tokens and user identity.

Q: Describe the purpose of `server/src/middlewares/validate.js`.
A: It likely validates request input against schemas to prevent invalid or malicious data from reaching controllers, improving reliability and security.

Q: What models are defined in the backend?
A: Mongoose models include `User`, `Medicine`, `Inventory`, `Prediction`, `Transaction`, `Alert`, and `Staff`. These map to key application entities and support inventory, forecasting, and pharmacy operations.

Q: How are alert jobs implemented?
A: The project includes `server/src/jobs/alertJob.js`, which likely runs scheduled tasks to check inventory levels and generate alerts for low stock or expiring medicines.

Q: How does the backend integrate with the ML service?
A: The backend uses `server/src/services/mlService.js` to call the ML service endpoint, send medicine and inventory data, and receive prediction forecasts.

---

## 4. Machine Learning Service (ml-service)

Q: What stack does the ML service use?
A: The ML service is built with FastAPI in Python. It uses a placeholder model and likely exposes a `/predict` endpoint.

Q: Why use FastAPI for the ML service?
A: FastAPI is fast, easy to deploy, provides automatic API docs, and handles async requests well. It is a good choice for serving machine learning predictions.

Q: What files define the ML service?
A: Key files include `ml-service/app/main.py`, `ml-service/app/routes/predict.py`, `ml-service/app/services/predictor.py`, and `ml-service/app/models/schemas.py`.

Q: How should the ML service be tested?
A: It can be tested with HTTP requests against its endpoint, unit tests for prediction logic, and validation of schema inputs/outputs. FastAPI’s built-in docs and test client support make this straightforward.

Q: What improvements would you make to the placeholder model?
A: Improvements include using a trained regression or time-series model, handling feature engineering, adding data validation, model versioning, and caching predictions.

---

## 5. Database and Data Layer

Q: Which database is used and why?
A: MongoDB is used for its flexible document model, which fits the evolving schema of inventory, transactions, and predictions. It also integrates well with Node.js and Mongoose.

Q: What database scripts are included?
A: The repo includes `database/mongo-init.js`, `database/seed-data.js`, and `database/indexes.js` for initializing the database, seeding sample data, and creating indexes.

Q: How would you optimize database performance for this application?
A: Add indexes on query-heavy fields, use pagination for large result sets, cache frequent queries, avoid unnecessary joins, and use aggregation pipelines for analytics.

Q: How does the project handle MongoDB connection config?
A: The backend uses `server/src/config/db.js` and `server/src/config/env.js` to read environment variables and configure the MongoDB connection.

Q: What are common MongoDB security best practices?
A: Use connection string secrets in environment variables, enable authentication, restrict network access, use TLS/SSL, and validate inputs to avoid injection.

---

## 6. API Design

Q: How is the API structured?
A: The backend has route modules under `server/src/routes`, such as `authRoutes.js`, `inventoryRoutes.js`, `predictionRoutes.js`, `dashboardRoutes.js`, `financialsRoutes.js`, `staffRoutes.js`, and `alertsRoutes.js`.

Q: What is the purpose of `server/src/routes/index.js`?
A: It likely combines all individual route modules into a single router for the app and centralizes API route registration.

Q: How does the backend handle errors?
A: Error handling is likely centralized through `server/src/middlewares/errorHandler.js`, which formats and returns API errors consistently.

Q: What request validation patterns are used?
A: Inputs are validated using separate validation files like `server/src/validations/authValidation.js` and `server/src/validations/inventoryValidation.js`, ensuring controllers receive valid data.

Q: How would you add versioning to the API?
A: Introduce route prefixes like `/api/v1/` and maintain multiple router versions. Document endpoints and migrate clients gradually.

---

## 7. Docker and Deployment

Q: How is Docker used in this project?
A: Docker Compose is configured in `docker-compose.yml` and service-specific Dockerfiles exist under `docker/` for `client`, `server`, and `ml-service`.

Q: What is the benefit of containerizing this application?
A: Containers ensure consistent runtime environments, simplify setup, make scaling easier, and support deployment to cloud or local development with minimal configuration.

Q: What would you inspect if `docker compose up --build` failed?
A: Check service logs, verify Dockerfile paths, ensure ports are free, confirm dependencies are installed, and validate environment variable files.

Q: How can you secure the deployment of this app?
A: Use HTTPS, strong JWT secrets, environment variables for secrets, secure MongoDB access, firewall rules, and container image scanning.

---

## 8. Security

Q: What security risks are relevant in this project?
A: Common risks include broken authentication, insecure JWT handling, injection attacks, improper validation, leaking secrets, and unprotected API endpoints.

Q: How can JWT token security be improved?
A: Use strong secret keys, set token expiration, support refresh tokens, store tokens securely on the client, and validate tokens server-side.

Q: What input validation should be performed?
A: Validate all user input for types, allowed values, and bounds. Sanitize strings, dates, and numeric fields, especially for login, inventory updates, and prediction requests.

Q: How do you protect the frontend from XSS?
A: Use safe React rendering patterns, avoid `dangerouslySetInnerHTML`, sanitize external data, and use CSP headers if possible.

---

## 9. Testing and Quality

Q: What kinds of tests would you add to this project?
A: Add unit tests for React components, Redux logic, and backend controllers. Add integration tests for API routes and ML service endpoints. Add end-to-end tests for core flows like login, inventory updates, and prediction visualization.

Q: How can you test the ML service independently?
A: Use FastAPI’s test client or HTTP requests targeting the prediction endpoint. Validate responses against expected schema and edge-case inputs.

Q: What is the role of linting and formatting here?
A: Linting ensures consistent code quality and catches errors early. Formatting keeps code readable and reduces merge conflicts.

---

## 10. Scaling and Reliability

Q: What are scaling considerations for this app?
A: Scale frontend statically or with a CDN, deploy backend and ML service separately, use managed MongoDB for high availability, and implement caching for heavy queries.

Q: How would you make the prediction service more resilient?
A: Add retries, circuit breaker patterns, health checks, request timeouts, and fallback behavior if the ML service is unavailable.

Q: How can you ensure data consistency across services?
A: Use idempotent API operations, transactions where possible, clear ownership of entities, and handle partial failures gracefully.

---

## 11. General SDE Interview Topics

Q: How do you design a reusable UI component?
A: Keep it focused on a single responsibility, accept props for customization, avoid hard-coded values, and document its behavior. Use composition and separate styling from logic.

Q: What is the difference between synchronous and asynchronous calls?
A: Synchronous calls block execution until completion, while asynchronous calls allow other work to continue and complete later through callbacks, promises, or async/await.

Q: What is a RESTful API?
A: A RESTful API uses HTTP methods and resource-based URLs to represent operations on data, and typically uses JSON payloads, stateless requests, and standard response codes.

Q: What are the SOLID principles?
A: SOLID stands for Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. These principles guide maintainable and extensible object-oriented design.

Q: What is CI/CD and why is it important?
A: Continuous Integration and Continuous Deployment automate building, testing, and releasing code, reducing manual errors and accelerating delivery.

---

## 12. Sample Behavioral/Process Questions

Q: How would you prioritize bug fixes versus feature development?
A: Evaluate impact, user pain, business value, and risk. Fix critical security or stability issues first, then schedule features with clear value and low risk.

Q: How do you handle conflicting requirements?
A: Clarify stakeholder needs, propose tradeoffs, document assumptions, and agree on the smallest viable solution before implementing.

Q: How do you ensure your code is easy to maintain?
A: Write clear code, add comments only where needed, use consistent patterns, add tests, and keep responsibilities small.

---

## 13. Project-Specific Deep Questions

Q: How does the application forecast inventory demand?
A: The backend uses the `ml-service` to send current inventory and historical data to a prediction endpoint. The service returns forecasts based on the deployed model, which the frontend displays in dashboards and prediction views.

Q: What are the main data flows when a user creates a transaction?
A: The client sends a request to the backend transaction API, which updates inventory and transaction records in MongoDB. If inventory falls below thresholds, alert jobs may generate notifications.

Q: How is alert generation handled?
A: Alert logic runs in `server/src/jobs/alertJob.js`, likely checking inventory levels, expiration dates, or stock thresholds, and saving alerts to the database or notifying users.

Q: How could this system support multiple pharmacies or locations?
A: Add a location or facility field to inventory and transaction models, scope queries by location, and extend UI filters. Use tenant-aware authorization for access control.

Q: What improvements would you make for production readiness?
A: Add monitoring/logging, use HTTPS, configure rate limiting, implement proper error tracking, add unit/integration tests, and move secrets to secure stores.

---

## 14. FAQs for Technical Discussion

Q: Why choose MongoDB for inventory data?
A: MongoDB handles flexible schema changes well, supports nested documents, and is easy to use with JavaScript-based backend code.

Q: What is the biggest risk in the current design?
A: The ML service is a placeholder without robust validation or production-ready model management. Another risk is exposing too much logic in API routes without strong validation and authorization.

Q: How would you add audit logging?
A: Implement middleware that records request metadata, user actions, timestamps, and affected resources. Store audit logs separately or append to database records.

Q: How could you migrate the ML service to a more advanced model?
A: Train a model on real historical sales data, add preprocessing pipelines, version the model artifact, and deploy it with a prediction endpoint behind a stable API contract.

---

## 15. Wrap-Up

Use this document as a study guide for architecture discussions, coding design questions, and system-level reasoning. The more you understand the project’s service boundaries, data flow, and security concerns, the better prepared you will be for an SDE interview.
