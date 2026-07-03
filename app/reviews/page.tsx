import { Suspense } from "react";
import ReviewsClient from "./reviews-client";

export default function ReviewsPage() {
  return (
    <Suspense fallback={null}>
      <ReviewsClient />
    </Suspense>
  );
}
