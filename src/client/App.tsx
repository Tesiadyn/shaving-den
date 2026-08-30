import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { Den } from "./pages/Den";
import { ItemDetail } from "./pages/ItemDetail";
import { ItemForm } from "./pages/ItemForm";
import { NotFound } from "./pages/NotFound";
import { ShareForm } from "./pages/ShareForm";
import { SharePublic } from "./pages/SharePublic";
import { ShaveForm } from "./pages/ShaveForm";
import { ShavePublic } from "./pages/ShavePublic";
import { Shaves } from "./pages/Shaves";
import { Stats } from "./pages/Stats";
import { Wheel } from "./pages/Wheel";

const router = createBrowserRouter([
  // 公開分享頁：不套用登入牆，任何人拿著連結都能看。
  { path: "share/:shareId", element: <SharePublic /> },
  { path: "shave/:shareId", element: <ShavePublic /> },
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
      { path: "den/share", element: <ShareForm /> },
      { path: "den/wheel", element: <Wheel /> },
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
