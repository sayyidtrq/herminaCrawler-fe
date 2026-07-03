import { Suspense } from "react";
import LocationsClient from "./locations-client";

export default function LocationsPage() {
  return (
    <Suspense fallback={null}>
      <LocationsClient />
    </Suspense>
  );
}
