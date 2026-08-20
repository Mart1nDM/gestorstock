import LandingPageClient from "./LandingPageClient";
import { isPlanKey, PLAN_BY_KEY, type PlanKey } from "../lib/plan-data";

export default function LandingPage({ searchParams }: { searchParams?: { plan?: string } }) {
  const plan = searchParams?.plan;
  const initialPlan: string = isPlanKey(plan) ? PLAN_BY_KEY[plan].name : "";
  return <LandingPageClient initialPlan={initialPlan} />;
}
