import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Configurator } from "./Configurator.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Configurator />}>
          <Route path="/" element={<></>} />
          <Route path="/configure/:id" element={<></>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
