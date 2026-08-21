import LandingPageClient from "./LandingPageClient";
import { isPlanKey, PLAN_BY_KEY, type PlanKey } from "../lib/plan-data";

export default async function LandingPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const plan = params?.plan;
  const initialPlan: string = isPlanKey(plan) ? PLAN_BY_KEY[plan].name : "";
  return <LandingPageClient initialPlan={initialPlan} />;
}
