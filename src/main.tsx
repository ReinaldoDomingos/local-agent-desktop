import React from "react";
import ReactDOM from "react-dom/client";
import { ServicesPage } from "./routes/services";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ServicesPage />
  </React.StrictMode>,
);
