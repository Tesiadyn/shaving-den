import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { Den } from "./pages/Den";
import { ItemDetail } from "./pages/ItemDetail";
import { ItemForm } from "./pages/ItemForm";
import { NotFound } from "./pages/NotFound";
import { ShaveForm } from "./pages/ShaveForm";
import { Shaves } from "./pages/Shaves";
import { Stats } from "./pages/Stats";

const router = createBrowserRouter([
  {
    element: (
      <AuthGate>
        <Layout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <Den /> },
      { path: "den", element: <Den /> },
      { path: "den/new", element: <ItemForm /> },
      { path: "den/:itemId", element: <ItemDetail /> },
      { path: "den/:itemId/edit", element: <ItemForm /> },
      { path: "shaves", element: <Shaves /> },
      { path: "shaves/new", element: <ShaveForm /> },
      { path: "stats", element: <Stats /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
