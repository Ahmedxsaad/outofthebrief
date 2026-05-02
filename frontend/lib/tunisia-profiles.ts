export type Sex = "F" | "M"

export type AdChannel = "billboards" | "tv" | "radio"

export type TunisianProfile = {
  id: string
  name: string
  sex: Sex
  age: number
  city: string
  governorate: string
  segment: string
  est_monthly_income_tnd: number
  purchase_intent: number // 0..100
  offline_ads_roi_score: Record<AdChannel, number> // 0..100
  expected_revenue_uplift_tnd: Record<AdChannel, number>
  notes?: string
}

export const tunisianProfiles: TunisianProfile[] = [
  {
    id: "TN-001",
    name: "Nour Ben Youssef",
    sex: "F",
    age: 27,
    city: "Tunis",
    governorate: "Tunis",
    segment: "Urban young professional",
    est_monthly_income_tnd: 2200,
    purchase_intent: 78,
    offline_ads_roi_score: { billboards: 72, tv: 61, radio: 54 },
    expected_revenue_uplift_tnd: { billboards: 4200, tv: 2800, radio: 1900 },
    notes: "High commute exposure + frequent retail visits.",
  },
  {
    id: "TN-002",
    name: "Ahmed Trabelsi",
    sex: "M",
    age: 34,
    city: "Sfax",
    governorate: "Sfax",
    segment: "SME operator",
    est_monthly_income_tnd: 3400,
    purchase_intent: 66,
    offline_ads_roi_score: { billboards: 58, tv: 73, radio: 62 },
    expected_revenue_uplift_tnd: { billboards: 2600, tv: 5200, radio: 3100 },
    notes: "TV performs well for trust-building in this segment.",
  },
  {
    id: "TN-003",
    name: "Rim Gharbi",
    sex: "F",
    age: 22,
    city: "Sousse",
    governorate: "Sousse",
    segment: "Student / early career",
    est_monthly_income_tnd: 1200,
    purchase_intent: 59,
    offline_ads_roi_score: { billboards: 64, tv: 48, radio: 57 },
    expected_revenue_uplift_tnd: { billboards: 2100, tv: 1200, radio: 1600 },
    notes: "Billboards near campuses convert better than TV.",
  },
  {
    id: "TN-004",
    name: "Hichem Bouaziz",
    sex: "M",
    age: 45,
    city: "Bizerte",
    governorate: "Bizerte",
    segment: "Family decision maker",
    est_monthly_income_tnd: 2800,
    purchase_intent: 71,
    offline_ads_roi_score: { billboards: 49, tv: 76, radio: 68 },
    expected_revenue_uplift_tnd: { billboards: 1700, tv: 6100, radio: 3900 },
    notes: "Prime-time TV + radio drive recall and action.",
  },
  {
    id: "TN-005",
    name: "Sarra Jlassi",
    sex: "F",
    age: 31,
    city: "Nabeul",
    governorate: "Nabeul",
    segment: "Tourism & services worker",
    est_monthly_income_tnd: 1900,
    purchase_intent: 63,
    offline_ads_roi_score: { billboards: 70, tv: 55, radio: 60 },
    expected_revenue_uplift_tnd: { billboards: 3600, tv: 2300, radio: 2400 },
    notes: "Outdoor placements near malls/arteries perform best.",
  },
  {
    id: "TN-006",
    name: "Youssef Hachicha",
    sex: "M",
    age: 29,
    city: "Ariana",
    governorate: "Ariana",
    segment: "Tech-savvy commuter",
    est_monthly_income_tnd: 2600,
    purchase_intent: 74,
    offline_ads_roi_score: { billboards: 75, tv: 58, radio: 65 },
    expected_revenue_uplift_tnd: { billboards: 4800, tv: 2500, radio: 3300 },
    notes: "High exposure to OOH around business districts.",
  },
  {
    id: "TN-007",
    name: "Meriem Khemiri",
    sex: "F",
    age: 39,
    city: "Monastir",
    governorate: "Monastir",
    segment: "Household manager",
    est_monthly_income_tnd: 2400,
    purchase_intent: 69,
    offline_ads_roi_score: { billboards: 52, tv: 71, radio: 73 },
    expected_revenue_uplift_tnd: { billboards: 1800, tv: 4700, radio: 5200 },
    notes: "Radio has strong reach during daytime routines.",
  },
  {
    id: "TN-008",
    name: "Mehdi Ben Romdhane",
    sex: "M",
    age: 24,
    city: "Kairouan",
    governorate: "Kairouan",
    segment: "Regional youth",
    est_monthly_income_tnd: 1100,
    purchase_intent: 52,
    offline_ads_roi_score: { billboards: 46, tv: 60, radio: 66 },
    expected_revenue_uplift_tnd: { billboards: 1200, tv: 2100, radio: 2600 },
    notes: "Radio is cost-effective in regional coverage.",
  },
]

