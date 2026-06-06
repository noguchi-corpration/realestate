import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/*
  箱庭不動産経営シミュレーター
  PC・スマホ両対応版

  方針：
  ・ゲーム処理はPC/スマホ共通
  ・画面表示だけCSSでレスポンシブ対応
  ・マップはスマホで横スクロール可能
  ・マップ拡大/縮小ボタンあり
  ・所有物件一覧クリックで建物詳細へジャンプ
*/

const MAP_SIZE = 70;
const SAVE_SLOT_COUNT = 3;
const DEFAULT_COMPANY_NAME = "野口コーポレーション";
const DEFAULT_SAVE_SLOT = 1;

function getSaveSlotKey(slot) {
  return `realEstateGameSave_slot${slot}`;
}

function getCurrentSaveSlot() {
  if (typeof window === "undefined") return DEFAULT_SAVE_SLOT;
  const rawSlot = Number(window.localStorage.getItem("realEstateGameCurrentSlot") ?? DEFAULT_SAVE_SLOT);
  if (!Number.isFinite(rawSlot)) return DEFAULT_SAVE_SLOT;
  return Math.min(SAVE_SLOT_COUNT, Math.max(1, Math.round(rawSlot)));
}

function readSaveSlot(slot) {
  if (typeof window === "undefined") return null;

  try {
    const rawSaveData = window.localStorage.getItem(getSaveSlotKey(slot));
    if (!rawSaveData) return null;
    const parsedSaveData = JSON.parse(rawSaveData);
    if (!parsedSaveData || typeof parsedSaveData !== "object") return null;
    if (!Array.isArray(parsedSaveData.tiles)) return null;
    return parsedSaveData;
  } catch (error) {
    console.warn(`Save slot ${slot} could not be loaded.`, error);
    return null;
  }
}


const OWNER = {
  PLAYER: "player",
  SALE: "sale",
  OTHER: "other",
  PUBLIC: "public",
  RIVAL: "rival",
};

const TERRAIN = {
  PLAIN: "plain",
  MOUNTAIN: "mountain",
  RIVER: "river",
  SEA: "sea",
};

const FEATURE = {
  NONE: null,
  ROAD: "road",
  STATION: "station",
  SCHOOL: "school",
  FACTORY: "factory",
  HQ: "hq",
  BRANCH: "branch",
};

const ZONE = {
  GENERAL: "general",
  RESIDENTIAL: "residential",
  COMMERCIAL: "commercial",
  INDUSTRIAL: "industrial",
};

const RIVAL_COMPANIES = {
  A: {
    id: "A",
    name: "東雲地所",
    colorClass: "rival-company-a-tile",
    rangeClass: "rival-company-a-range-tile",
    colorName: "水色",
    initialMoney: 30000,
  },
  B: {
    id: "B",
    name: "紫苑リアルティ",
    colorClass: "rival-company-b-tile",
    rangeClass: "rival-company-b-range-tile",
    colorName: "緑",
    initialMoney: 30000,
  },
  C: {
    id: "C",
    name: "大手ライバル",
    colorClass: "rival-company-c-tile",
    rangeClass: "rival-company-c-range-tile",
    colorName: "紫",
    initialMoney: 120000,
    lateEntry: true,
  },
};

const INITIAL_RIVAL_COMPANY_IDS = ["A", "B"];
const MAX_RIVAL_COMPANY_COUNT = 3;
const LATE_RIVAL_COMPANY_ID = "C";

const RIVAL_COMPANY_NAME_CANDIDATES = [
  "東雲地所",
  "紫苑リアルティ",
  "サンライズ開発",
  "青葉不動産",
  "みらい都市開発",
  "中央プロパティ",
  "北斗地所",
  "アーバンリンク",
  "大成ホームズ",
  "さくら総合開発",
  "グリーンエステート",
  "港町リアルティ",
  "山城地所",
  "ひかり不動産",
  "ネクスト都市開発",
  "東海住建",
  "三河プロパティ",
  "名南地所",
  "西濃開発",
  "清流エステート",
];

function pickRandomRivalCompanyNames(count) {
  const shuffledNames = [...RIVAL_COMPANY_NAME_CANDIDATES].sort(() => Math.random() - 0.5);
  return shuffledNames.slice(0, count);
}

function getRivalCompany(companyId) {
  return RIVAL_COMPANIES[companyId] ?? RIVAL_COMPANIES.A;
}

function getRivalCompanyNameFromTiles(tileList, companyId) {
  const hqTile = tileList.find((tile) => {
    return tile.owner === OWNER.RIVAL &&
      tile.rivalCompanyId === companyId &&
      tile.feature === FEATURE.HQ;
  });

  return hqTile?.rivalCompanyName ?? getRivalCompany(companyId).name;
}

const BANKS = {
  nonbank: {
    id: "nonbank",
    name: "ノンバンク",
    shortName: "ノンバンク",
    rate: 0.075,
    maxYears: 10,
    approvalMultiplier: 10,
    collateralRate: 0.25,
    minRank: 1,
    description: "金利は高いが、銀行より審査が柔軟。急ぎの小口資金に使いやすい。",
  },
  regional: {
    id: "regional",
    name: "地方銀行",
    shortName: "地銀",
    rate: 0.028,
    maxYears: 20,
    approvalMultiplier: 18,
    collateralRate: 0.55,
    minRank: 1,
    description: "金利はやや高いが、地方の不動産投資に積極的。序盤から使いやすい銀行。",
  },
  shinkin: {
    id: "shinkin",
    name: "信用金庫",
    shortName: "信金",
    rate: 0.023,
    maxYears: 25,
    approvalMultiplier: 15,
    collateralRate: 0.5,
    minRank: 2,
    description: "地域密着型。金利と審査のバランスが良く、安定経営向き。",
  },
  megabank: {
    id: "megabank",
    name: "メガバンク",
    shortName: "メガ",
    rate: 0.017,
    maxYears: 30,
    approvalMultiplier: 12,
    collateralRate: 0.45,
    minRank: 4,
    description: "低金利で大型融資に強いが、ランク・返済余力・自己資本を厳しく見る。",
  },
};

function calculateMonthlyLoanPayment(principal, annualRate, years) {
  const months = years * 12;
  const monthlyRate = annualRate / 12;

  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return Math.ceil(principal / months);

  return Math.ceil(
    principal * monthlyRate * Math.pow(1 + monthlyRate, months) /
      (Math.pow(1 + monthlyRate, months) - 1)
  );
}

function normalizeLoan(loan) {
  const bank = BANKS[loan?.bankId] ?? BANKS.regional;
  const principal = Math.max(0, Math.round(loan?.principal ?? loan?.remaining ?? 0));
  const years = Math.max(1, Math.round(loan?.years ?? bank.maxYears));
  const annualRate = loan?.annualRate ?? bank.rate;
  const monthlyPayment = loan?.monthlyPayment ?? calculateMonthlyLoanPayment(principal, annualRate, years);

  return {
    id: loan?.id ?? `loan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bankId: bank.id,
    bankName: bank.name,
    principal,
    remaining: Math.max(0, Math.round(loan?.remaining ?? principal)),
    annualRate,
    years,
    monthsLeft: Math.max(1, Math.round(loan?.monthsLeft ?? years * 12)),
    monthlyPayment,
    borrowedAt: loan?.borrowedAt ?? "",
  };
}

function getLoanReviewMonths(amount) {
  const requestedAmount = Math.max(0, Math.round(Number(amount) || 0));

  if (requestedAmount >= 20000) return 3;
  if (requestedAmount >= 5000) return 2;

  return 1;
}

function getLoanNegotiationPower(actionEmployees) {
  const members = Array.isArray(actionEmployees) ? actionEmployees : [];
  if (members.length === 0) return 0;

  const total = members.reduce((sum, employee) => {
    return sum +
      (employee.sales ?? 0) * 0.5 +
      (employee.management ?? 0) * 0.35 +
      (employee.leadership ?? 0) * 0.15;
  }, 0);

  return Math.round(total / members.length);
}

function getLoanTeamAverage(actionEmployees, statKey) {
  const members = Array.isArray(actionEmployees) ? actionEmployees : [];
  if (members.length === 0) return 0;

  const total = members.reduce((sum, employee) => sum + (employee[statKey] ?? 0), 0);
  return Math.round(total / members.length);
}

function normalizePendingLoanApplication(application) {
  const bank = BANKS[application?.bankId] ?? BANKS.regional;
  const requestedAmount = Math.max(0, Math.round(application?.requestedAmount ?? 0));
  if (requestedAmount <= 0) return null;

  const reviewMonths = Math.max(1, Math.round(application?.reviewMonths ?? getLoanReviewMonths(requestedAmount)));

  return {
    id: application?.id ?? `loan-app-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bankId: bank.id,
    bankName: bank.name,
    requestedAmount,
    reviewMonths,
    monthsLeft: Math.max(1, Math.round(application?.monthsLeft ?? reviewMonths)),
    appliedAt: application?.appliedAt ?? "",
    employeeIds: Array.isArray(application?.employeeIds) ? application.employeeIds : [],
    employeeNames: Array.isArray(application?.employeeNames) ? application.employeeNames : [],
    negotiationPower: Math.max(0, Math.round(application?.negotiationPower ?? 0)),
    salesAverage: Math.max(0, Math.round(application?.salesAverage ?? 0)),
    managementAverage: Math.max(0, Math.round(application?.managementAverage ?? 0)),
    leadershipAverage: Math.max(0, Math.round(application?.leadershipAverage ?? 0)),
    consultationReportId: application?.consultationReportId ?? null,
    consultationRecommendedAmount: Math.max(0, Math.round(application?.consultationRecommendedAmount ?? 0)),
    consultationEstimatedMin: Math.max(0, Math.round(application?.consultationEstimatedMin ?? 0)),
    consultationEstimatedMax: Math.max(0, Math.round(application?.consultationEstimatedMax ?? 0)),
    consultationPower: Math.max(0, Math.round(application?.consultationPower ?? 0)),
    consultationEmployeeName: application?.consultationEmployeeName ?? "",
  };
}


function normalizePendingLoanConsultation(consultation) {
  const bank = BANKS[consultation?.bankId] ?? BANKS.regional;

  return {
    id: consultation?.id ?? `loan-consult-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bankId: bank.id,
    bankName: bank.name,
    monthsLeft: Math.max(1, Math.round(consultation?.monthsLeft ?? 1)),
    requestedAt: consultation?.requestedAt ?? "",
    employeeId: consultation?.employeeId ?? null,
    employeeName: consultation?.employeeName ?? "",
    consultationPower: Math.max(0, Math.round(consultation?.consultationPower ?? 0)),
    sales: Math.max(0, Math.round(consultation?.sales ?? 0)),
    management: Math.max(0, Math.round(consultation?.management ?? 0)),
  };
}

function normalizeLoanConsultationReport(report) {
  const bank = BANKS[report?.bankId] ?? BANKS.regional;

  return {
    id: report?.id ?? `loan-report-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bankId: bank.id,
    bankName: bank.name,
    reportedAt: report?.reportedAt ?? "",
    employeeName: report?.employeeName ?? "",
    estimatedMin: Math.max(0, Math.round(report?.estimatedMin ?? 0)),
    estimatedMax: Math.max(0, Math.round(report?.estimatedMax ?? 0)),
    recommendedAmount: Math.max(0, Math.round(report?.recommendedAmount ?? 0)),
    outlookLabel: report?.outlookLabel ?? "不明",
    comment: report?.comment ?? "相談結果を確認できませんでした。",
    riskNotes: Array.isArray(report?.riskNotes) ? report.riskNotes : [],
    consultationPower: Math.max(0, Math.round(report?.consultationPower ?? 0)),
    createdMonth: Number.isFinite(Number(report?.createdMonth)) ? Math.round(Number(report.createdMonth)) : null,
    expiresMonth: Number.isFinite(Number(report?.expiresMonth)) ? Math.round(Number(report.expiresMonth)) : null,
    used: report?.used === true,
  };
}


const TENANT_TYPES = {
  SINGLE: { name: "単身", peopleMin: 1, peopleMax: 1, rentPower: 1.0 },
  COUPLE: { name: "夫婦", peopleMin: 2, peopleMax: 2, rentPower: 1.1 },
  FAMILY: { name: "ファミリー", peopleMin: 3, peopleMax: 5, rentPower: 1.25 },
  DORM: { name: "法人寮", peopleMin: 4, peopleMax: 8, rentPower: 1.35 },
  SHOP: { name: "店舗テナント", peopleMin: 0, peopleMax: 0, rentPower: 1.5 },
};

const BUILDINGS = {
  house_1f: {
  category: "住宅",
  subCategory: "戸建",
  structure: "木造",
  lifeYears: 22,

  name: "平屋戸建",
    short: "平",
    cost: 2500,
    baseRent: 14,
    rooms: 1,
    buildMonths: 2,
    width: 1,
    height: 1,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
  house_2f: {
  category: "住宅",
  subCategory: "戸建",

  structure: "木造",
  lifeYears: 22,

  name: "2階建戸建",
    short: "2H",
    cost: 3000,
    baseRent: 16,
    rooms: 1,
    buildMonths: 3,
    width: 1,
    height: 1,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
  house_3f: {
    category: "住宅",
    subCategory: "戸建",
      structure: "木造",
  lifeYears: 22,
    name: "3階建戸建",
    short: "3H",
    cost: 3500,
    baseRent: 18,
    rooms: 1,
    buildMonths: 4,
    width: 1,
    height: 1,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },

  apt_2f_family: {
    category: "住宅",
    subCategory: "アパート",
            structure: "鉄骨造",
  lifeYears: 34,
    name: "2階建アパート",
    short: "2A",
    cost: 8000,
    baseRent: 10,
    rooms: 4,
    buildMonths: 6,
    width: 2,
    height: 1,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
  apt_3f_single: {
    category: "住宅",
    subCategory: "アパート",
         structure: "鉄骨造",
  lifeYears: 34,
    name: "3階建アパート",
    short: "3A",
    cost: 12000,
    baseRent: 12,
    rooms: 6,
    buildMonths: 7,
    width: 1,
    height: 2,
    allowedTenants:  ["SINGLE", "COUPLE", "FAMILY"],
  },

    apt_2f_single: {
  category: "住宅",
  subCategory: "アパート",

  structure: "鉄骨造",
  lifeYears: 34,

  name: "社宅アパート",
  short: "社",

  cost: 10000,
  baseRent: 6,

  rooms: 10,

  buildMonths: 6,

  width: 2,
  height: 1,

  allowedTenants: ["SINGLE"],
},

  mansion_5f: {
    subCategory: "マンション",
  category: "住宅",

  structure: "RC造",
  lifeYears: 47,

  name: "5階建マンション",
    short: "5M",
    cost: 45000,
    baseRent: 15,
    rooms: 15,
    buildMonths: 12,
    width: 2,
    height: 2,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
  mansion_7f: {
    category: "住宅",
    subCategory: "マンション",

  structure: "RC造",
  lifeYears: 47,
    name: "7階建マンション",
    short: "7M",
    cost: 60000,
    baseRent: 17,
    rooms: 21,
    buildMonths: 18,
    width: 2,
    height: 3,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
    convenience: {
    category: "商業",
    structure: "鉄骨造",
    lifeYears: 34,
    name: "コンビニ",
    short: "コ",
    cost: 3500,
    baseRent: 35,
    rooms: 1,
    buildMonths: 3,
    width: 1,
    height: 1,
    allowedTenants: ["SHOP"],
  },

  restaurant: {
    category: "商業",
    structure: "木造",
    lifeYears: 22,
    name: "飲食店",
    short: "飯",
    cost: 6000,
    baseRent: 55,
    rooms: 1,
    buildMonths: 3,
    width: 1,
    height: 1,
    allowedTenants: ["SHOP"],
  },

  drugstore: {
    category: "商業",
    structure: "鉄骨造",
    lifeYears: 34,
    name: "ドラッグストア",
    short: "薬",
    cost: 12000,
    baseRent: 110,
    rooms: 1,
    buildMonths: 4,
    width: 2,
    height: 1,
    allowedTenants: ["SHOP"],
  },

  supermarket: {
    category: "商業",
    structure: "鉄骨造",
    lifeYears: 34,
    name: "スーパー",
    short: "ス",
    cost: 22000,
    baseRent: 220,
    rooms: 1,
    buildMonths: 6,
    width: 2,
    height: 2,
    allowedTenants: ["SHOP"],
  },

  commercial_big: {
    category: "商業",
    name: "大型商業施設",
    structure: "RC造",
    lifeYears: 47,
    short: "大商",
    cost: 50000,
    baseRent: 550,
    rooms: 3,
    buildMonths: 12,
    width: 3,
    height: 2,
    allowedTenants: ["SHOP"],
  },
   hq_apartment: {
    category: "本社",
    structure: "RC造",
    lifeYears: 47,
    name: "アパート付き本社",
    short: "本A",
    cost: 8000,
    baseRent: 12,
    rooms: 4,
    buildMonths: 0,
    width: 1,
    height: 1,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },

  small_factory: {
  category: "工業",
  structure: "鉄骨造",
  lifeYears: 34,

  name: "町工場",
  short: "町",

  cost: 8000,
  baseRent: 80,

  rooms: 1,

  buildMonths: 4,

  width: 1,
  height: 1,

  allowedTenants: ["SHOP"],
},

medium_factory: {
  category: "工業",
  structure: "鉄骨造",
  lifeYears: 34,

  name: "中規模工場",
  short: "中工",

  cost: 22000,
  baseRent: 220,

  rooms: 1,

  buildMonths: 8,

  width: 2,
  height: 2,

  allowedTenants: ["SHOP"],
},

large_factory: {
  category: "工業",
  structure: "鉄骨造",
  lifeYears: 38,

  name: "大規模工場",
  short: "大工",

  cost: 70000,
  baseRent: 700,

  rooms: 1,

  buildMonths: 16,

  width: 3,
  height: 3,

  allowedTenants: ["SHOP"],
},

warehouse: {
  category: "工業",
  structure: "鉄骨造",
  lifeYears: 34,

  name: "倉庫",
  short: "倉",

  cost: 12000,
  baseRent: 90,

  rooms: 1,

  buildMonths: 4,

  width: 2,
  height: 1,

  allowedTenants: ["SHOP"],
},

logistics_center: {
  category: "工業",
  structure: "鉄骨造",
  lifeYears: 38,

  name: "物流センター",
  short: "物",

  cost: 35000,
  baseRent: 300,

  rooms: 1,

  buildMonths: 10,

  width: 3,
  height: 2,

  allowedTenants: ["SHOP"],
},
  commercial_big: {
    category: "商業",
    name: "大型商業施設",
     structure: "RC造",
  lifeYears: 47,
    short: "大商",
    cost: 50000,
    baseRent: 300,
    rooms: 4,
    buildMonths: 14,
    width: 3,
    height: 2,
    allowedTenants: ["SHOP"],
  },
};
const HQ_TYPES = {
  normal: {
    name: "本社",
    short: "本",

    cost: 3000,
    rooms: 0,
  },

  apartment: {
    name: "アパート付き本社",
    cost: 8000,
    rooms: 4,
    baseRent: 12,
    allowedTenants: ["SINGLE", "COUPLE", "FAMILY"],
  },
};

const BUILDING_CATEGORIES = [
  "住宅",
  "商業",
  "工業",
];

const EMPLOYEE_POOL = [
  {
    id: 1,
    name: "青井アリス",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 14,
    sales: 17,
    construction: 38,
    management: 31,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 2,
    name: "赤城 蒼太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 22,
    construction: 15,
    management: 35,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 3,
    name: "秋月 葵",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 23,
    construction: 31,
    management: 29,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 4,
    name: "浅倉 茜",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 13,
    sales: 22,
    construction: 45,
    management: 26,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 5,
    name: "朝比奈 朝陽",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 26,
    sales: 40,
    construction: 34,
    management: 35,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 6,
    name: "芦田エマ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 22,
    sales: 35,
    construction: 39,
    management: 27,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 7,
    name: "アステリア・リージュ",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 47,
    construction: 30,
    management: 33,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 8,
    name: "東野リナ",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 20,
    sales: 21,
    construction: 44,
    management: 44,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 9,
    name: "天城 明日香",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 28,
    construction: 29,
    management: 34,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 10,
    name: "天野 彩",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 56,
    sales: 20,
    construction: 28,
    management: 17,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 11,
    name: "有坂 歩",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 14,
    construction: 24,
    management: 47,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 12,
    name: "有馬リア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 31,
    construction: 30,
    management: 39,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 13,
    name: "安藤 一樹",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 15,
    sales: 30,
    construction: 44,
    management: 20,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 14,
    name: "飯島 彩花",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 23,
    construction: 47,
    management: 32,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 15,
    name: "飯田 一真",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 31,
    sales: 39,
    construction: 32,
    management: 49,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 16,
    name: "五十嵐ノア",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 48,
    construction: 47,
    management: 22,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 17,
    name: "池上 彩乃",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 31,
    construction: 25,
    management: 13,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 18,
    name: "池田 綾音",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 30,
    construction: 27,
    management: 44,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 19,
    name: "石上 一翔",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 14,
    construction: 32,
    management: 37,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 20,
    name: "石川 一成",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 13,
    sales: 15,
    construction: 22,
    management: 48,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 21,
    name: "石橋 伊吹",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 10,
    sales: 37,
    construction: 29,
    management: 28,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 22,
    name: "石森ミア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 17,
    construction: 34,
    management: 31,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 23,
    name: "泉 瑛太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 45,
    sales: 20,
    construction: 32,
    management: 37,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 24,
    name: "伊勢リオ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 41,
    sales: 36,
    construction: 34,
    management: 41,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 25,
    name: "磯部 英司",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 30,
    sales: 41,
    construction: 40,
    management: 27,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 26,
    name: "市川エレン",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 35,
    construction: 27,
    management: 40,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 27,
    name: "一条 杏",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 35,
    sales: 36,
    construction: 30,
    management: 17,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 28,
    name: "一ノ瀬 大輝",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 37,
    sales: 39,
    construction: 37,
    management: 27,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 29,
    name: "伊東 杏奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 20,
    sales: 36,
    construction: 36,
    management: 28,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 30,
    name: "伊吹 伊織",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 37,
    sales: 34,
    construction: 44,
    management: 15,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 31,
    name: "今井 大地",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 30,
    construction: 35,
    management: 48,
    salary: 23,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 32,
    name: "岩倉 一華",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 53,
    sales: 20,
    construction: 35,
    management: 20,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 33,
    name: "岩崎 詩織",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 22,
    sales: 44,
    construction: 30,
    management: 18,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 34,
    name: "上杉 海斗",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 49,
    sales: 16,
    construction: 39,
    management: 37,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 35,
    name: "上原 海翔",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 32,
    sales: 31,
    construction: 42,
    management: 48,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 36,
    name: "宇佐美セリア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 26,
    sales: 32,
    construction: 24,
    management: 23,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 37,
    name: "内田 岳",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 27,
    sales: 30,
    construction: 25,
    management: 46,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 38,
    name: "アステリア・レイン",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 27,
    sales: 47,
    construction: 31,
    management: 32,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 39,
    name: "梅原 羽月",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 42,
    construction: 34,
    management: 38,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 40,
    name: "江川 奏太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 19,
    construction: 46,
    management: 28,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 41,
    name: "アステリア・アクア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 17,
    sales: 21,
    construction: 51,
    management: 18,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 42,
    name: "アステリア・ミスティ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 34,
    construction: 17,
    management: 30,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 43,
    name: "江口クララ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 40,
    sales: 38,
    construction: 36,
    management: 27,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 44,
    name: "榎本 恭平",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 34,
    sales: 47,
    construction: 17,
    management: 24,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 45,
    name: "遠藤 圭",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 33,
    construction: 42,
    management: 32,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 46,
    name: "大沢 英里",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 18,
    sales: 41,
    construction: 19,
    management: 28,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 47,
    name: "大島 圭吾",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 34,
    construction: 41,
    management: 26,
    salary: 17,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 48,
    name: "大月 健",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 37,
    sales: 38,
    construction: 31,
    management: 15,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 49,
    name: "大友 恵",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 35,
    construction: 19,
    management: 31,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 50,
    name: "大西 絵里香",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 37,
    construction: 33,
    management: 37,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 51,
    name: "大野 央奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 36,
    construction: 32,
    management: 29,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 52,
    name: "岡崎 桜",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 30,
    sales: 44,
    construction: 59,
    management: 19,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 53,
    name: "アステリア・レクレス",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 14,
    construction: 31,
    management: 28,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 54,
    name: "岡田 健太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 30,
    sales: 45,
    construction: 29,
    management: 42,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 55,
    name: "岡野 桜子",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 24,
    construction: 22,
    management: 26,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 56,
    name: "小笠原 音羽",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 39,
    sales: 44,
    construction: 40,
    management: 28,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 57,
    name: "小川サラ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 40,
    sales: 25,
    construction: 38,
    management: 40,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 58,
    name: "奥田 健斗",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 43,
    sales: 47,
    construction: 28,
    management: 27,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 59,
    name: "小倉 航",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 40,
    sales: 41,
    construction: 13,
    management: 34,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 60,
    name: "小沢 佳奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 18,
    construction: 21,
    management: 30,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 61,
    name: "アステリア・オリヴィア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 43,
    construction: 29,
    management: 16,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 62,
    name: "小田レイナ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 13,
    sales: 28,
    construction: 35,
    management: 41,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 63,
    name: "小野寺 香澄",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 35,
    construction: 42,
    management: 25,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 64,
    name: "アステリア・イリア",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 35,
    sales: 43,
    construction: 35,
    management: 10,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 65,
    name: "小原 花蓮",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 24,
    construction: 23,
    management: 20,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 66,
    name: "小山 航平",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 27,
    sales: 16,
    construction: 31,
    management: 46,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 67,
    name: "海藤 希",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 20,
    sales: 18,
    construction: 26,
    management: 31,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 68,
    name: "香坂 季奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 26,
    sales: 25,
    construction: 26,
    management: 27,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 69,
    name: "風間 光希",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 39,
    construction: 16,
    management: 18,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 70,
    name: "アステリア・ノヴァ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 24,
    construction: 14,
    management: 41,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 71,
    name: "片桐 康介",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 32,
    construction: 25,
    management: 20,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 72,
    name: "片瀬 孝太郎",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 31,
    construction: 26,
    management: 35,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 73,
    name: "加藤 琴音",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 41,
    sales: 18,
    construction: 24,
    management: 24,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 74,
    name: "金沢 悟",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 36,
    construction: 22,
    management: 33,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 75,
    name: "神崎 小春",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 41,
    construction: 48,
    management: 19,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 76,
    name: "神谷 朔",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 35,
    sales: 15,
    construction: 35,
    management: 47,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 77,
    name: "狩野 紗季",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 16,
    sales: 20,
    construction: 42,
    management: 24,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 78,
    name: "川上 颯",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 54,
    sales: 35,
    construction: 23,
    management: 34,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 79,
    name: "川島 紗良",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 15,
    sales: 33,
    construction: 19,
    management: 32,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 80,
    name: "川瀬 咲",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 40,
    construction: 41,
    management: 25,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 81,
    name: "川端 颯太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 39,
    sales: 20,
    construction: 43,
    management: 41,
    salary: 23,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 82,
    name: "アステリア・ルーン",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 19,
    sales: 15,
    construction: 22,
    management: 41,
    salary: 17,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 83,
    name: "アステリア・セレス",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 31,
    construction: 17,
    management: 15,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 84,
    name: "河村 咲良",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 10,
    sales: 38,
    construction: 41,
    management: 32,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 85,
    name: "神田 颯真",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 32,
    sales: 10,
    construction: 37,
    management: 49,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 86,
    name: "菊池 沙耶",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 43,
    sales: 44,
    construction: 35,
    management: 32,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 87,
    name: "岸本 修",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 20,
    construction: 38,
    management: 14,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 88,
    name: "アステリア・フィリア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 39,
    construction: 31,
    management: 28,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 89,
    name: "北川 詩乃",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 27,
    sales: 32,
    construction: 25,
    management: 13,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 90,
    name: "北条 志穂",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 29,
    construction: 31,
    management: 35,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 91,
    name: "北見 朱里",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 32,
    sales: 39,
    construction: 34,
    management: 42,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 92,
    name: "木下 隼人",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 13,
    sales: 51,
    construction: 18,
    management: 18,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 93,
    name: "木島 純奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 31,
    sales: 29,
    construction: 34,
    management: 12,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 94,
    name: "木戸リリア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 31,
    sales: 40,
    construction: 37,
    management: 37,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 95,
    name: "霧島 鈴",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 32,
    sales: 52,
    construction: 30,
    management: 35,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 96,
    name: "桐谷 澄香",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 10,
    construction: 28,
    management: 35,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 97,
    name: "久我 星奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 37,
    construction: 48,
    management: 33,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 98,
    name: "草薙 翔",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 26,
    construction: 43,
    management: 45,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 99,
    name: "久保 翔太",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 15,
    construction: 38,
    management: 27,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 100,
    name: "熊谷 翔真",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 26,
    sales: 32,
    construction: 26,
    management: 24,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 101,
    name: "倉田 新",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 37,
    construction: 39,
    management: 24,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 102,
    name: "黒川 慎",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 31,
    construction: 36,
    management: 33,
    salary: 18,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 103,
    name: "黒崎マリア",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 36,
    construction: 22,
    management: 50,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 104,
    name: "黒瀬 芹奈",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 25,
    sales: 26,
    construction: 33,
    management: 24,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 105,
    name: "桑原 千尋",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 23,
    construction: 23,
    management: 53,
    salary: 22,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 106,
    name: "アステリア・レグナ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 22,
    sales: 29,
    construction: 16,
    management: 43,
    salary: 15,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 107,
    name: "小泉 慎一",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 22,
    construction: 10,
    management: 26,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 108,
    name: "小清水 千夏",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 13,
    construction: 11,
    management: 47,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 109,
    name: "小柴レナ",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 30,
    construction: 39,
    management: 36,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 110,
    name: "小杉 樹",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 23,
    construction: 41,
    management: 41,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 111,
    name: "小滝エリカ",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 44,
    construction: 37,
    management: 41,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 112,
    name: "小鳥遊 月乃",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 44,
    construction: 26,
    management: 44,
    salary: 23,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 113,
    name: "近藤 駿",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 48,
    sales: 29,
    construction: 32,
    management: 35,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 114,
    name: "西園寺 純",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 29,
    construction: 39,
    management: 18,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 115,
    name: "斎賀 椿",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 40,
    sales: 44,
    construction: 23,
    management: 22,
    salary: 21,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "遅刻魔",
    ],
    specialCodes: [
      "LATE_COMER",
    ],
    specialDescriptions: [
      "行動成功率を5％下げる。",
    ],
  },
  {
    id: 116,
    name: "斉藤 凪",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 39,
    sales: 25,
    construction: 45,
    management: 35,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 117,
    name: "榊原カレン",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 39,
    sales: 28,
    construction: 30,
    management: 27,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 118,
    name: "坂井ソフィア",
    gender: "male",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 41,
    sales: 41,
    construction: 36,
    management: 12,
    salary: 19,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 119,
    name: "坂口 奈緒",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 24,
    sales: 56,
    construction: 18,
    management: 19,
    salary: 16,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 120,
    name: "坂下 菜月",
    gender: "female",
    rarity: "N",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 35,
    construction: 36,
    management: 32,
    salary: 17,
    officeId: "storage",
    graphicCode: null,
    specialNames: [],
    specialCodes: [],
    specialDescriptions: [],
  },
  {
    id: 121,
    name: "坂本 七瀬",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 43,
    sales: 41,
    construction: 21,
    management: 45,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "交渉上手",
    ],
    specialCodes: [
      "NEGOTIATION_GOOD",
    ],
    specialDescriptions: [
      "土地購入価格を3％下げる。",
    ],
  },
  {
    id: 122,
    name: "佐伯 仁",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 58,
    sales: 48,
    construction: 52,
    management: 33,
    salary: 36,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 123,
    name: "佐久間 奈々",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 33,
    sales: 41,
    construction: 50,
    management: 41,
    salary: 29,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "買い叩き",
    ],
    specialCodes: [
      "BARGAIN_BUYER",
    ],
    specialDescriptions: [
      "土地購入価格を8％下げる。",
    ],
  },
  {
    id: 124,
    name: "桜井 菜々子",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 35,
    sales: 54,
    construction: 52,
    management: 64,
    salary: 36,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 125,
    name: "笹原ミラ",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 40,
    sales: 31,
    construction: 55,
    management: 31,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "カリスマ営業",
    ],
    specialCodes: [
      "CHARISMA_SALES",
    ],
    specialDescriptions: [
      "営業能力を10上げる。",
    ],
  },
  {
    id: 126,
    name: "佐々木 仁美",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 45,
    sales: 42,
    construction: 47,
    management: 36,
    salary: 32,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 127,
    name: "里見 乃愛",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 32,
    sales: 42,
    construction: 66,
    management: 29,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "ヘッドハンター",
    ],
    specialCodes: [
      "HEADHUNTER",
    ],
    specialDescriptions: [
      "社員募集時の募集人数を1人増やす。",
    ],
  },
  {
    id: 128,
    name: "真田 誠",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 29,
    sales: 33,
    construction: 37,
    management: 54,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 129,
    name: "沢城 遥",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 54,
    sales: 15,
    construction: 52,
    management: 46,
    salary: 23,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "ベテラン大工",
    ],
    specialCodes: [
      "VETERAN_CARPENTER",
    ],
    specialDescriptions: [
      "工期を15％短縮する。",
    ],
  },
  {
    id: 130,
    name: "沢村 陽菜",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 23,
    sales: 40,
    construction: 51,
    management: 46,
    salary: 27,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 131,
    name: "椎名 ひかり",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 62,
    construction: 22,
    management: 46,
    salary: 31,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "品質第一",
    ],
    specialCodes: [
      "QUALITY_FIRST",
    ],
    specialDescriptions: [
      "建物状態を10上げる。",
    ],
  },
  {
    id: 132,
    name: "篠原 日菜子",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 46,
    sales: 56,
    construction: 49,
    management: 32,
    salary: 37,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 133,
    name: "アステリア・クロノ",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 52,
    sales: 33,
    construction: 41,
    management: 48,
    salary: 33,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "DIY職人",
    ],
    specialCodes: [
      "DIY_CRAFTSMAN",
    ],
    specialDescriptions: [
      "軽修繕費を50％下げる。",
    ],
  },
  {
    id: 134,
    name: "柴崎ルナ",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 27,
    sales: 53,
    construction: 35,
    management: 49,
    salary: 23,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 135,
    name: "柴田 雛乃",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 33,
    construction: 28,
    management: 49,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "管理の達人",
    ],
    specialCodes: [
      "MANAGEMENT_MASTER",
    ],
    specialDescriptions: [
      "空室率を5％改善する。",
    ],
  },
  {
    id: 136,
    name: "アステリア・アルカ",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 39,
    sales: 47,
    construction: 48,
    management: 37,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 137,
    name: "渋谷シオン",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 49,
    sales: 49,
    construction: 17,
    management: 43,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "お客様第一",
    ],
    specialCodes: [
      "CUSTOMER_FIRST",
    ],
    specialDescriptions: [
      "退去率を10％下げる。",
    ],
  },
  {
    id: 138,
    name: "島崎 蒼真",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 41,
    construction: 36,
    management: 60,
    salary: 36,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 139,
    name: "島田 壮太",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 21,
    sales: 55,
    construction: 58,
    management: 61,
    salary: 32,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "クレーム対応力",
    ],
    specialCodes: [
      "CLAIM_HANDLER",
    ],
    specialDescriptions: [
      "入居者満足度を10上げる。",
    ],
  },
  {
    id: 140,
    name: "清水 太一",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 35,
    construction: 47,
    management: 33,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 141,
    name: "白石 大吾",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 63,
    sales: 39,
    construction: 38,
    management: 49,
    salary: 37,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "リーダー",
    ],
    specialCodes: [
      "LEADER",
    ],
    specialDescriptions: [
      "同じ支店の社員能力を3％上げる。",
    ],
  },
  {
    id: 142,
    name: "白鳥 文香",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 30,
    sales: 31,
    construction: 51,
    management: 48,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 143,
    name: "新庄 大介",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 41,
    sales: 31,
    construction: 56,
    management: 34,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "カリスマ所長",
    ],
    specialCodes: [
      "CHARISMA_MANAGER",
    ],
    specialDescriptions: [
      "同じ支店の社員能力を10％上げる。",
    ],
  },
  {
    id: 144,
    name: "新田 拓海",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 30,
    construction: 50,
    management: 38,
    salary: 33,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 145,
    name: "末永ルカ",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 46,
    sales: 43,
    construction: 46,
    management: 25,
    salary: 26,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "熱血上司",
    ],
    specialCodes: [
      "PASSIONATE_BOSS",
    ],
    specialDescriptions: [
      "獲得経験値を20％上げる。",
    ],
  },
  {
    id: 146,
    name: "菅原 拓也",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 54,
    sales: 49,
    construction: 53,
    management: 30,
    salary: 36,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 147,
    name: "杉浦 穂乃花",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 59,
    sales: 34,
    construction: 46,
    management: 44,
    salary: 31,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "交渉上手",
    ],
    specialCodes: [
      "NEGOTIATION_GOOD",
    ],
    specialDescriptions: [
      "土地購入価格を3％下げる。",
    ],
  },
  {
    id: 148,
    name: "杉本 真央",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 48,
    sales: 38,
    construction: 50,
    management: 34,
    salary: 27,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 149,
    name: "鈴原 真希",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 50,
    sales: 47,
    construction: 51,
    management: 30,
    salary: 33,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "買い叩き",
    ],
    specialCodes: [
      "BARGAIN_BUYER",
    ],
    specialDescriptions: [
      "土地購入価格を8％下げる。",
    ],
  },
  {
    id: 150,
    name: "須藤 真琴",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 28,
    sales: 56,
    construction: 56,
    management: 52,
    salary: 40,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 151,
    name: "瀬川 真白",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 50,
    sales: 41,
    construction: 57,
    management: 54,
    salary: 39,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "カリスマ営業",
    ],
    specialCodes: [
      "CHARISMA_SALES",
    ],
    specialDescriptions: [
      "営業能力を10上げる。",
    ],
  },
  {
    id: 152,
    name: "瀬戸 匠",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 52,
    sales: 27,
    construction: 51,
    management: 60,
    salary: 38,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 153,
    name: "芹沢 美緒",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 45,
    sales: 27,
    construction: 46,
    management: 58,
    salary: 28,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "ヘッドハンター",
    ],
    specialCodes: [
      "HEADHUNTER",
    ],
    specialDescriptions: [
      "社員募集時の募集人数を1人増やす。",
    ],
  },
  {
    id: 154,
    name: "園田 司",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 52,
    sales: 37,
    construction: 45,
    management: 64,
    salary: 37,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 155,
    name: "高岡 美咲",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 58,
    sales: 46,
    construction: 43,
    management: 48,
    salary: 33,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "ベテラン大工",
    ],
    specialCodes: [
      "VETERAN_CARPENTER",
    ],
    specialDescriptions: [
      "工期を15％短縮する。",
    ],
  },
  {
    id: 156,
    name: "高城 美月",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 45,
    construction: 44,
    management: 29,
    salary: 29,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 157,
    name: "高瀬 美波",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 49,
    construction: 34,
    management: 47,
    salary: 29,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "品質第一",
    ],
    specialCodes: [
      "QUALITY_FIRST",
    ],
    specialDescriptions: [
      "建物状態を10上げる。",
    ],
  },
  {
    id: 158,
    name: "高槻 美優",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 24,
    sales: 58,
    construction: 52,
    management: 43,
    salary: 29,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 159,
    name: "高梨 美結",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 51,
    sales: 43,
    construction: 32,
    management: 24,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "DIY職人",
    ],
    specialCodes: [
      "DIY_CRAFTSMAN",
    ],
    specialDescriptions: [
      "軽修繕費を50％下げる。",
    ],
  },
  {
    id: 160,
    name: "高野 翼",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 46,
    sales: 34,
    construction: 58,
    management: 52,
    salary: 37,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 161,
    name: "高橋 瑞希",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 37,
    sales: 31,
    construction: 35,
    management: 47,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "管理の達人",
    ],
    specialCodes: [
      "MANAGEMENT_MASTER",
    ],
    specialDescriptions: [
      "空室率を5％改善する。",
    ],
  },
  {
    id: 162,
    name: "高柳レオン",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 38,
    sales: 50,
    construction: 41,
    management: 36,
    salary: 34,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 163,
    name: "滝沢カイ",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 34,
    sales: 54,
    construction: 26,
    management: 46,
    salary: 26,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "お客様第一",
    ],
    specialCodes: [
      "CUSTOMER_FIRST",
    ],
    specialDescriptions: [
      "退去率を10％下げる。",
    ],
  },
  {
    id: 164,
    name: "アステリア・ルーチェ",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 51,
    sales: 57,
    construction: 48,
    management: 44,
    salary: 40,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 165,
    name: "武内 瑞穂",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 55,
    sales: 51,
    construction: 46,
    management: 35,
    salary: 33,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "クレーム対応力",
    ],
    specialCodes: [
      "CLAIM_HANDLER",
    ],
    specialDescriptions: [
      "入居者満足度を10上げる。",
    ],
  },
  {
    id: 166,
    name: "アステリア・ベル",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 37,
    sales: 39,
    construction: 43,
    management: 48,
    salary: 29,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 167,
    name: "竹下 哲也",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 46,
    sales: 48,
    construction: 48,
    management: 54,
    salary: 35,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "リーダー",
    ],
    specialCodes: [
      "LEADER",
    ],
    specialDescriptions: [
      "同じ支店の社員能力を3％上げる。",
    ],
  },
  {
    id: 168,
    name: "竹中 湊",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 44,
    sales: 34,
    construction: 55,
    management: 43,
    salary: 40,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 169,
    name: "橘ユリス",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 48,
    construction: 28,
    management: 45,
    salary: 27,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "カリスマ所長",
    ],
    specialCodes: [
      "CHARISMA_MANAGER",
    ],
    specialDescriptions: [
      "同じ支店の社員能力を10％上げる。",
    ],
  },
  {
    id: 170,
    name: "田島 徹",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 48,
    sales: 44,
    construction: 40,
    management: 66,
    salary: 38,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 171,
    name: "田代 未来",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 55,
    sales: 35,
    construction: 48,
    management: 47,
    salary: 35,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "熱血上司",
    ],
    specialCodes: [
      "PASSIONATE_BOSS",
    ],
    specialDescriptions: [
      "獲得経験値を20％上げる。",
    ],
  },
  {
    id: 172,
    name: "立花ノエル",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 46,
    sales: 39,
    construction: 27,
    management: 48,
    salary: 24,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 173,
    name: "田中リオン",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 18,
    construction: 43,
    management: 46,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "交渉上手",
    ],
    specialCodes: [
      "NEGOTIATION_GOOD",
    ],
    specialDescriptions: [
      "土地購入価格を3％下げる。",
    ],
  },
  {
    id: 174,
    name: "アステリア・クラウン",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 42,
    sales: 52,
    construction: 56,
    management: 49,
    salary: 40,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "浪費家",
    ],
    specialCodes: [
      "SPENDER",
    ],
    specialDescriptions: [
      "給与が20％上がる。",
    ],
  },
  {
    id: 175,
    name: "田辺 芽衣",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 47,
    sales: 49,
    construction: 60,
    management: 45,
    salary: 40,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "買い叩き",
    ],
    specialCodes: [
      "BARGAIN_BUYER",
    ],
    specialDescriptions: [
      "土地購入価格を8％下げる。",
    ],
  },
  {
    id: 176,
    name: "谷口 芽依",
    gender: "female",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 36,
    sales: 44,
    construction: 40,
    management: 41,
    salary: 20,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "不器用",
    ],
    specialCodes: [
      "CLUMSY",
    ],
    specialDescriptions: [
      "建築能力が10下がる。",
    ],
  },
  {
    id: 177,
    name: "千葉 直樹",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 54,
    sales: 39,
    construction: 38,
    management: 52,
    salary: 34,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "カリスマ営業",
    ],
    specialCodes: [
      "CHARISMA_SALES",
    ],
    specialDescriptions: [
      "営業能力を10上げる。",
    ],
  },
  {
    id: 178,
    name: "月城 直人",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 55,
    sales: 51,
    construction: 37,
    management: 32,
    salary: 25,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "面倒くさがり",
    ],
    specialCodes: [
      "LAZY",
    ],
    specialDescriptions: [
      "管理能力が10下がる。",
    ],
  },
  {
    id: 179,
    name: "アステリア・ヴェール",
    gender: "male",
    rarity: "R",
    level: 1,
    exp: 0,
    awakening: 0,
    awakeningMax: 0,
    leadership: 58,
    sales: 56,
    construction: 24,
    management: 53,
    salary: 38,
    officeId: "storage",
    graphicCode: null,
    specialNames: [
      "ヘッドハンター",
    ],
    specialCodes: [
      "HEADHUNTER",
    ],
    specialDescriptions: [
      "社員募集時の募集人数を1人増やす。",
   ],
},
{
id: 501,
    name: "風間 優莉",
    gender: "female",
    rarity: "HR",
    leadership: 55,
    sales: 76,
    construction: 44,
    management: 53,
    salary: 44,
    graphicCode: "HR001",
    specialNames: [
      "お客様第一"
    ]
  },

{
    id: 502,
    name: "椎名 陽葵",
    gender: "female",
    rarity: "HR",
    leadership: 70,
    sales: 42,
    construction: 59,
    management: 71,
    salary: 55,
    graphicCode: "HR002",
    specialNames: [
      "不動産鑑定士"
    ]
  },

{
    id: 503,
    name: "真白 杏奈",
    gender: "female",
    rarity: "HR",
    leadership: 56,
    sales: 54,
    construction: 67,
    management: 63,
    salary: 55,
    graphicCode: "HR003",
    specialNames: [
      "名将",
    ]
  },

{
    id: 504,
    name: "宮藤 千歳",
    gender: "female",
    rarity: "HR",
    leadership: 74,
    sales: 78,
    construction: 72,
    management: 45,
    salary: 55,
    graphicCode: "HR004",
    specialNames: [
      "巡回名人"
    ]
  },

{
    id: 505,
    name: "久遠 奏",
    gender: "female",
    rarity: "HR",
    leadership: 65,
    sales: 57,
    construction: 76,
    management: 49,
    salary: 55,
    graphicCode: "HR005",
    specialNames: [
      "交渉上手",
    ]
  },

{
    id: 506,
    name: "葛城 澪",
    gender: "female",
    rarity: "HR",
    leadership: 60,
    sales: 49,
    construction: 69,
    management: 70,
    salary: 55,
    graphicCode: "HR006",
    specialNames: [
      "ヘッドハンター",
    ]
  },

{
    id: 507,
    name: "氷室 真琴",
    gender: "female",
    rarity: "HR",
    leadership: 69,
    sales: 61,
    construction: 64,
    management: 66,
    salary: 55,
    graphicCode: "HR007",
    specialNames: [
      "修繕の匠"
    ]
  },

{
    id: 508,
    name: "藤堂 陽菜",
    gender: "female",
    rarity: "HR",
    leadership: 50,
    sales: 80,
    construction: 64,
    management: 61,
    salary: 55,
    graphicCode: "HR008",
    specialNames: [
      "買い叩き",
    ]
  },

{
    id: 509,
    name: "七瀬 灯里",
    gender: "female",
    rarity: "HR",
    leadership: 65,
    sales: 70,
    construction: 47,
    management: 57,
    salary: 55,
    graphicCode: "HR009",
    specialNames: [
      "管理の達人",
    ]
  },

{
    id: 510,
    name: "榊 莉子",
    gender: "female",
    rarity: "HR",
    leadership: 76,
    sales: 69,
    construction: 64,
    management: 55,
    salary: 55,
    graphicCode: "HR010",
    specialNames: [
      "ヘッドハンター"
    ]
  },

{
    id: 511,
    name: "橘 花蓮",
    gender: "female",
    rarity: "HR",
    leadership: 53,
    sales: 42,
    construction: 51,
    management: 60,
    salary: 42,
    graphicCode: "HR011",
    specialNames: [
      "品質第一"
    ]
  },

{
    id: 512,
    name: "天城 美咲",
    gender: "female",
    rarity: "HR",
    leadership: 62,
    sales: 46,
    construction: 58,
    management: 52,
    salary: 40,
    graphicCode: "HR012",
    specialNames: [
      "お客様第一",
    ]
  },

{
    id: 513,
    name: "東雲 詩織",
    gender: "female",
    rarity: "HR",
    leadership: 64,
    sales: 60,
    construction: 44,
    management: 42,
    salary: 46,
    graphicCode: "HR013",
    specialNames: [
      "ベテラン大工",
    ]
  },

{
    id: 514,
    name: "姫宮 楓",
    gender: "female",
    rarity: "HR",
    leadership: 64,
    sales: 50,
    construction: 77,
    management: 75,
    salary: 55,
    graphicCode: "HR014",
    specialNames: [
      "お客様第一"
    ]
  },

{
    id: 515,
    name: "有栖 美月",
    gender: "female",
    rarity: "HR",
    leadership: 67,
    sales: 43,
    construction: 76,
    management: 71,
    salary: 55,
    graphicCode: "HR015",
    specialNames: [
      "お客様第一"
    ]
  },

{
    id: 516,
    name: "桜庭 紬",
    gender: "female",
    rarity: "HR",
    leadership: 66,
    sales: 44,
    construction: 73,
    management: 47,
    salary: 44,
    graphicCode: "HR016",
    specialNames: [
      "カリスマ所長"
    ]
  },

{
    id: 517,
    name: "御影 雫",
    gender: "female",
    rarity: "HR",
    leadership: 75,
    sales: 76,
    construction: 55,
    management: 48,
    salary: 55,
    graphicCode: "HR017",
    specialNames: [
      "節約家",
    ]
  },

{
    id: 518,
    name: "浅倉 凛",
    gender: "female",
    rarity: "HR",
    leadership: 80,
    sales: 63,
    construction: 71,
    management: 46,
    salary: 55,
    graphicCode: "HR018",
    specialNames: [
      "不動産鑑定士",
    ]
  },

{
    id: 519,
    name: "霧島 小春",
    gender: "female",
    rarity: "HR",
    leadership: 78,
    sales: 63,
    construction: 66,
    management: 43,
    salary: 55,
    graphicCode: "HR019",
    specialNames: [
      "一級建築士"
    ]
  },

{
    id: 520,
    name: "相沢 彩葉",
    gender: "female",
    rarity: "HR",
    leadership: 78,
    sales: 79,
    construction: 62,
    management: 48,
    salary: 55,
    graphicCode: "HR020",
    specialNames: [
      "買い叩き"
    ]
  },

{
    id: 521,
    name: "成瀬 瑞希",
    gender: "female",
    rarity: "HR",
    leadership: 43,
    sales: 58,
    construction: 65,
    management: 76,
    salary: 51,
    graphicCode: "HR021",
    specialNames: [
      "クレーム対応力",
    ]
  },

{
    id: 522,
    name: "柏木 詩音",
    gender: "female",
    rarity: "HR",
    leadership: 68,
    sales: 50,
    construction: 72,
    management: 46,
    salary: 55,
    graphicCode: "HR022",
    specialNames: [
      "ヘッドハンター",
    ]
  },

{
    id: 523,
    name: "長瀬 莉奈",
    gender: "female",
    rarity: "HR",
    leadership: 80,
    sales: 47,
    construction: 70,
    management: 71,
    salary: 55,
    graphicCode: "HR023",
    specialNames: [
      "凄腕交渉人"
    ]
  },

{
    id: 524,
    name: "神谷 心春",
    gender: "female",
    rarity: "HR",
    leadership: 46,
    sales: 43,
    construction: 71,
    management: 54,
    salary: 46,
    graphicCode: "HR024",
    specialNames: [
      "交渉上手",
    ]
  },

{
    id: 525,
    name: "相馬 優菜",
    gender: "female",
    rarity: "HR",
    leadership: 64,
    sales: 56,
    construction: 50,
    management: 42,
    salary: 46,
    graphicCode: "HR025",
    specialNames: [
      "ベテラン大工"
    ]
  },

{
    id: 526,
    name: "月城 琴葉",
    gender: "female",
    rarity: "HR",
    leadership: 48,
    sales: 47,
    construction: 62,
    management: 77,
    salary: 47,
    graphicCode: "HR026",
    specialNames: [
      "管理の達人"
    ]
  },

{
    id: 527,
    name: "冬月 澪奈",
    gender: "female",
    rarity: "HR",
    leadership: 77,
    sales: 44,
    construction: 63,
    management: 48,
    salary: 55,
    graphicCode: "HR027",
    specialNames: [
      "交渉上手"
    ]
  },

{
    id: 528,
    name: "夏目 凛花",
    gender: "female",
    rarity: "HR",
    leadership: 70,
    sales: 48,
    construction: 45,
    management: 45,
    salary: 43,
    graphicCode: "HR028",
    specialNames: [
      "カリスマ所長"
    ]
  },

{
    id: 529,
    name: "蓮見 若菜",
    gender: "female",
    rarity: "HR",
    leadership: 75,
    sales: 43,
    construction: 42,
    management: 75,
    salary: 49,
    graphicCode: "HR029",
    specialNames: [
      "お客様第一"
    ]
  },

{
    id: 530,
    name: "白河 美帆",
    gender: "female",
    rarity: "HR",
    leadership: 49,
    sales: 51,
    construction: 65,
    management: 62,
    salary: 44,
    graphicCode: "HR030",
    specialNames: [
      "教育係"
    ]
  },

{
    id: 531,
    name: "黒崎 沙耶",
    gender: "female",
    rarity: "HR",
    leadership: 59,
    sales: 56,
    construction: 62,
    management: 70,
    salary: 55,
    graphicCode: "HR031",
    specialNames: [
      "クレーム対応力"
    ]
  },

{
    id: 532,
    name: "一条 乃愛",
    gender: "female",
    rarity: "HR",
    leadership: 60,
    sales: 48,
    construction: 64,
    management: 63,
    salary: 53,
    graphicCode: "HR032",
    specialNames: [
      "巡回名人"
    ]
  },

{
    id: 533,
    name: "鳴海 由依",
    gender: "female",
    rarity: "HR",
    leadership: 68,
    sales: 50,
    construction: 58,
    management: 67,
    salary: 55,
    graphicCode: "HR033",
    specialNames: [
      "熱血上司"
    ]
  },

{
    id: 534,
    name: "高瀬 美優",
    gender: "female",
    rarity: "HR",
    leadership: 50,
    sales: 58,
    construction: 79,
    management: 68,
    salary: 55,
    graphicCode: "HR034",
    specialNames: [
      "巡回名人",
    ]
  },

{
    id: 535,
    name: "青柳 結衣",
    gender: "female",
    rarity: "HR",
    leadership: 77,
    sales: 61,
    construction: 46,
    management: 59,
    salary: 55,
    graphicCode: "HR035",
    specialNames: [
      "人脈王",
    ]
  },

{
    id: 536,
    name: "白石 エレナ",
    gender: "female",
    rarity: "HR",
    leadership: 78,
    sales: 72,
    construction: 54,
    management: 43,
    salary: 55,
    graphicCode: "HR036",
    specialNames: [
      "お客様第一",
    ]
  },

{
    id: 537,
    name: "神崎 レイナ",
    gender: "female",
    rarity: "HR",
    leadership: 56,
    sales: 56,
    construction: 46,
    management: 75,
    salary: 52,
    graphicCode: "HR037",
    specialNames: [
      "管理の達人"
    ]
  },

{
    id: 538,
    name: "朝倉 アリサ",
    gender: "female",
    rarity: "HR",
    leadership: 56,
    sales: 69,
    construction: 61,
    management: 53,
    salary: 55,
    graphicCode: "HR038",
    specialNames: [
      "カリスマ所長"
    ]
  },

{
    id: 539,
    name: "高城 ミレイ",
    gender: "female",
    rarity: "HR",
    leadership: 42,
    sales: 62,
    construction: 53,
    management: 71,
    salary: 53,
    graphicCode: "HR039",
    specialNames: [
      "教育係"
    ]
  },

{
    id: 540,
    name: "結城 セリナ",
    gender: "female",
    rarity: "HR",
    leadership: 44,
    sales: 74,
    construction: 75,
    management: 43,
    salary: 51,
    graphicCode: "HR040",
    specialNames: [
      "一級建築士"
    ]
  },

{
    id: 541,
    name: "篠宮 リア",
    gender: "female",
    rarity: "HR",
    leadership: 55,
    sales: 46,
    construction: 61,
    management: 57,
    salary: 45,
    graphicCode: "HR041",
    specialNames: [
      "ベテラン大工"
    ]
  },

{
    id: 542,
    name: "天音 エマ",
    gender: "female",
    rarity: "HR",
    leadership: 45,
    sales: 59,
    construction: 42,
    management: 76,
    salary: 55,
    graphicCode: "HR042",
    specialNames: [
      "管理の達人",
    ]
  },

{
    id: 543,
    name: "御剣 レナ",
    gender: "female",
    rarity: "HR",
    leadership: 47,
    sales: 70,
    construction: 79,
    management: 70,
    salary: 55,
    graphicCode: "HR043",
    specialNames: [
      "DIY職人"
    ]
  },

{
    id: 544,
    name: "西野 アンナ",
    gender: "female",
    rarity: "HR",
    leadership: 48,
    sales: 48,
    construction: 58,
    management: 71,
    salary: 54,
    graphicCode: "HR044",
    specialNames: [
      "ヘッドハンター"
    ]
  },

{
    id: 545,
    name: "三条 ミア",
    gender: "female",
    rarity: "HR",
    leadership: 65,
    sales: 53,
    construction: 65,
    management: 53,
    salary: 51,
    graphicCode: "HR045",
    specialNames: [
      "不動産鑑定士"
    ]
  },

{
    id: 546,
    name: "ヴィオレッタ・グレイス",
    gender: "female",
    rarity: "HR",
    leadership: 78,
    sales: 58,
    construction: 46,
    management: 73,
    salary: 55,
    graphicCode: "HR046",
    specialNames: [
      "カリスマ所長"
    ]
  },

{
    id: 547,
    name: "セラフィナ・レイン",
    gender: "female",
    rarity: "HR",
    leadership: 47,
    sales: 78,
    construction: 75,
    management: 68,
    salary: 55,
    graphicCode: "HR047",
    specialNames: [
      "凄腕交渉人",
    ]
  },

{
    id: 548,
    name: "アステリア・クロフォード",
    gender: "female",
    rarity: "HR",
    leadership: 57,
    sales: 59,
    construction: 47,
    management: 72,
    salary: 55,
    graphicCode: "HR048",
    specialNames: [
      "管理の達人"
    ]
  },

{
    id: 549,
    name: "ノエリア・フォスター",
    gender: "female",
    rarity: "HR",
    leadership: 66,
    sales: 55,
    construction: 50,
    management: 46,
    salary: 50,
    graphicCode: "HR049",
    specialNames: [
      "人脈王"
    ]
  },

{
    id: 550,
    name: "リリアナ・ベルモンド",
    gender: "female",
    rarity: "HR",
    leadership: 51,
    sales: 69,
    construction: 65,
    management: 78,
    salary: 55,
    graphicCode: "HR050",
    specialNames: [
      "家賃回収人",
    ]
  },

{
    id: 651,
    name: "神楽 美琴",
    gender: "female",
    rarity: "SR",
    leadership: 82,
    sales: 77,
    construction: 57,
    management: 62,
    salary: 66,
    graphicCode: "SR001",
    specialNames: [
      "リーダー",
      "伝説の営業マン"
    ]
  },

{
    id: 652,
    name: "朝霧 麗奈",
    gender: "female",
    rarity: "SR",
    leadership: 84,
    sales: 68,
    construction: 90,
    management: 57,
    salary: 89,
    graphicCode: "SR002",
    specialNames: [
      "現場監督",
      "修繕の匠"
    ]
  },

{
    id: 653,
    name: "如月 朱音",
    gender: "female",
    rarity: "SR",
    leadership: 87,
    sales: 58,
    construction: 64,
    management: 61,
    salary: 70,
    graphicCode: "SR003",
    specialNames: [
      "名将",
      "交渉上手"
    ]
  },

{
    id: 654,
    name: "羽柴 琴音",
    gender: "female",
    rarity: "SR",
    leadership: 60,
    sales: 66,
    construction: 94,
    management: 70,
    salary: 74,
    graphicCode: "SR004",
    specialNames: [
      "熱血上司",
      "解体屋"
    ]
  },

{
    id: 655,
    name: "高梨 華蓮",
    gender: "female",
    rarity: "SR",
    leadership: 66,
    sales: 66,
    construction: 55,
    management: 93,
    salary: 68,
    graphicCode: "SR005",
    specialNames: [
      "クレーム対応力",
      "巡回名人"
    ]
  },

{
    id: 656,
    name: "雪村 沙羅",
    gender: "female",
    rarity: "SR",
    leadership: 59,
    sales: 79,
    construction: 79,
    management: 84,
    salary: 96,
    graphicCode: "SR006",
    specialNames: [
      "クレーム対応力",
      "買い叩き"
    ]
  },

{
    id: 657,
    name: "秋月 瑠奈",
    gender: "female",
    rarity: "SR",
    leadership: 65,
    sales: 94,
    construction: 73,
    management: 75,
    salary: 91,
    graphicCode: "SR007",
    specialNames: [
      "修繕の匠",
      "リーダー"
    ]
  },

{
    id: 658,
    name: "桐谷 美羽",
    gender: "female",
    rarity: "SR",
    leadership: 78,
    sales: 89,
    construction: 61,
    management: 56,
    salary: 74,
    graphicCode: "SR008",
    specialNames: [
      "人脈王",
      "一級建築士"
    ]
  },

{
    id: 659,
    name: "速水 紗夜",
    gender: "female",
    rarity: "SR",
    leadership: 84,
    sales: 66,
    construction: 65,
    management: 59,
    salary: 75,
    graphicCode: "SR009",
    specialNames: [
      "再生屋",
      "熱血上司"
    ]
  },

{
    id: 660,
    name: "森川 紗月",
    gender: "female",
    rarity: "SR",
    leadership: 67,
    sales: 58,
    construction: 68,
    management: 69,
    salary: 60,
    graphicCode: "SR010",
    specialNames: [
      "賃貸王",
      "不動産投資家"
    ]
  },

{
    id: 661,
    name: "北条 美桜",
    gender: "female",
    rarity: "SR",
    leadership: 82,
    sales: 89,
    construction: 90,
    management: 56,
    salary: 97,
    graphicCode: "SR011",
    specialNames: [
      "熱血上司",
      "不動産鑑定士"
    ]
  },

{
    id: 662,
    name: "南雲 千尋",
    gender: "female",
    rarity: "SR",
    leadership: 81,
    sales: 63,
    construction: 95,
    management: 63,
    salary: 97,
    graphicCode: "SR012",
    specialNames: [
      "ヘッドハンター",
      "カリスマ所長"
    ]
  },

{
    id: 663,
    name: "瀬戸 美緒",
    gender: "female",
    rarity: "SR",
    leadership: 60,
    sales: 75,
    construction: 57,
    management: 95,
    salary: 83,
    graphicCode: "SR013",
    specialNames: [
      "クレーム対応力",
      "ベテラン大工"
    ]
  },

{
    id: 664,
    name: "伊吹 涼音",
    gender: "female",
    rarity: "SR",
    leadership: 63,
    sales: 89,
    construction: 76,
    management: 79,
    salary: 87,
    graphicCode: "SR014",
    specialNames: [
      "賃貸王",
      "お客様第一"
    ]
  },

{
    id: 665,
    name: "白雪 美里",
    gender: "female",
    rarity: "SR",
    leadership: 62,
    sales: 61,
    construction: 72,
    management: 63,
    salary: 60,
    graphicCode: "SR015",
    specialNames: [
      "リーダー",
      "交渉上手"
    ]
  },

{
    id: 666,
    name: "桐生 遥香",
    gender: "female",
    rarity: "SR",
    leadership: 83,
    sales: 68,
    construction: 77,
    management: 70,
    salary: 93,
    graphicCode: "SR016",
    specialNames: [
      "カリスマ営業",
      "お客様第一"
    ]
  },

{
    id: 667,
    name: "天宮 香澄",
    gender: "female",
    rarity: "SR",
    leadership: 70,
    sales: 89,
    construction: 72,
    management: 57,
    salary: 69,
    graphicCode: "SR017",
    specialNames: [
      "一級建築士",
      "名将"
    ]
  },

{
    id: 668,
    name: "月島 明日香",
    gender: "female",
    rarity: "SR",
    leadership: 61,
    sales: 65,
    construction: 61,
    management: 73,
    salary: 60,
    graphicCode: "SR018",
    specialNames: [
      "凄腕交渉人",
      "ベテラン大工"
    ]
  },

{
    id: 669,
    name: "御門 琴乃",
    gender: "female",
    rarity: "SR",
    leadership: 78,
    sales: 74,
    construction: 59,
    management: 86,
    salary: 76,
    graphicCode: "SR019",
    specialNames: [
      "交渉上手",
      "賃貸王"
    ]
  },

{
    id: 670,
    name: "白鷺 美奈",
    gender: "female",
    rarity: "SR",
    leadership: 55,
    sales: 73,
    construction: 63,
    management: 95,
    salary: 64,
    graphicCode: "SR020",
    specialNames: [
      "人脈王",
      "カリスマ営業"
    ]
  },

{
    id: 671,
    name: "鷹司 由奈",
    gender: "female",
    rarity: "SR",
    leadership: 75,
    sales: 83,
    construction: 56,
    management: 76,
    salary: 69,
    graphicCode: "SR021",
    specialNames: [
      "人脈王",
      "賃貸王"
    ]
  },

{
    id: 672,
    name: "榎本 エリカ",
    gender: "female",
    rarity: "SR",
    leadership: 95,
    sales: 63,
    construction: 55,
    management: 88,
    salary: 82,
    graphicCode: "SR022",
    specialNames: [
      "名将",
      "カリスマ所長"
    ]
  },

{
    id: 673,
    name: "藤崎 リナ",
    gender: "female",
    rarity: "SR",
    leadership: 62,
    sales: 92,
    construction: 72,
    management: 67,
    salary: 85,
    graphicCode: "SR023",
    specialNames: [
      "伝説の営業マン",
      "再生屋"
    ]
  },

{
    id: 674,
    name: "綾瀬 ミナ",
    gender: "female",
    rarity: "SR",
    leadership: 67,
    sales: 69,
    construction: 60,
    management: 95,
    salary: 75,
    graphicCode: "SR024",
    specialNames: [
      "ヘッドハンター",
      "買い叩き"
    ]
  },

{
    id: 675,
    name: "若宮 セイラ",
    gender: "female",
    rarity: "SR",
    leadership: 68,
    sales: 82,
    construction: 77,
    management: 79,
    salary: 87,
    graphicCode: "SR025",
    specialNames: [
      "人脈王",
      "節約家"
    ]
  },

{
    id: 676,
    name: "日向 ノア",
    gender: "female",
    rarity: "SR",
    leadership: 58,
    sales: 72,
    construction: 68,
    management: 82,
    salary: 73,
    graphicCode: "SR026",
    specialNames: [
      "クレーム対応力",
      "人脈王"
    ]
  },

{
    id: 677,
    name: "水城 リオ",
    gender: "female",
    rarity: "SR",
    leadership: 82,
    sales: 77,
    construction: 71,
    management: 67,
    salary: 77,
    graphicCode: "SR027",
    specialNames: [
      "管理の達人",
      "カリスマ営業"
    ]
  },

{
    id: 678,
    name: "雨宮 カレン",
    gender: "female",
    rarity: "SR",
    leadership: 72,
    sales: 55,
    construction: 69,
    management: 65,
    salary: 61,
    graphicCode: "SR028",
    specialNames: [
      "買い叩き",
      "軍師"
    ]
  },

{
    id: 679,
    name: "花宮 ルナ",
    gender: "female",
    rarity: "SR",
    leadership: 84,
    sales: 78,
    construction: 73,
    management: 80,
    salary: 96,
    graphicCode: "SR029",
    specialNames: [
      "巡回名人",
      "軍師"
    ]
  },

{
    id: 680,
    name: "フレデリカ・スターリング",
    gender: "female",
    rarity: "SR",
    leadership: 65,
    sales: 69,
    construction: 71,
    management: 77,
    salary: 72,
    graphicCode: "SR030",
    specialNames: [
      "管理の達人",
      "買い叩き"
    ]
  },

{
    id: 781,
    name: "神宮寺 薫",
    gender: "female",
    rarity: "SSR",
    leadership: 82,
    sales: 86,
    construction: 91,
    management: 80,
    salary: 104,
    graphicCode: "SSR001",
    specialNames: [
      "管理の達人",
      "人脈王",
      "野口メソッド"
    ]
  },

{
    id: 782,
    name: "水無月 麗華",
    gender: "female",
    rarity: "SSR",
    leadership: 81,
    sales: 99,
    construction: 68,
    management: 98,
    salary: 103,
    graphicCode: "SSR002",
    specialNames: [
      "軍師",
      "お客様第一",
      "地方創生"
    ]
  },

{
    id: 783,
    name: "九条院 美玲",
    gender: "female",
    rarity: "SSR",
    leadership: 82,
    sales: 96,
    construction: 74,
    management: 89,
    salary: 97,
    graphicCode: "SSR003",
    specialNames: [
      "不動産鑑定士",
      "交渉上手",
      "百戦錬磨"
    ]
  },

{
    id: 784,
    name: "一ノ瀬 美和",
    gender: "female",
    rarity: "SSR",
    leadership: 96,
    sales: 85,
    construction: 78,
    management: 98,
    salary: 134,
    graphicCode: "SSR004",
    specialNames: [
      "教育係",
      "買い叩き",
      "不動産神"
    ]
  },

{
    id: 785,
    name: "桐嶋 涼",
    gender: "female",
    rarity: "SSR",
    leadership: 71,
    sales: 90,
    construction: 94,
    management: 83,
    salary: 103,
    graphicCode: "SSR005",
    specialNames: [
      "一級建築士",
      "現場監督",
      "百戦錬磨"
    ]
  },

{
    id: 786,
    name: "神代 霞",
    gender: "female",
    rarity: "SSR",
    leadership: 100,
    sales: 87,
    construction: 88,
    management: 76,
    salary: 113,
    graphicCode: "SSR006",
    specialNames: [
      "巡回名人",
      "伝説の営業マン",
      "百戦錬磨"
    ]
  },

{
    id: 787,
    name: "皇 玲",
    gender: "female",
    rarity: "SSR",
    leadership: 100,
    sales: 80,
    construction: 92,
    management: 93,
    salary: 133,
    graphicCode: "SSR007",
    specialNames: [
      "交渉上手",
      "不動産鑑定士",
      "地方創生"
    ]
  },

{
    id: 788,
    name: "鳳 芹奈",
    gender: "female",
    rarity: "SSR",
    leadership: 72,
    sales: 80,
    construction: 67,
    management: 100,
    salary: 80,
    graphicCode: "SSR008",
    specialNames: [
      "お客様第一",
      "カリスマ営業",
      "野口メソッド"
    ]
  },

{
    id: 789,
    name: "宝生 紫苑",
    gender: "female",
    rarity: "SSR",
    leadership: 94,
    sales: 77,
    construction: 76,
    management: 92,
    salary: 112,
    graphicCode: "SSR009",
    specialNames: [
      "一級建築士",
      "カリスマ営業",
      "不動産神"
    ]
  },

{
    id: 790,
    name: "飛鳥 凪沙",
    gender: "female",
    rarity: "SSR",
    leadership: 87,
    sales: 95,
    construction: 83,
    management: 75,
    salary: 98,
    graphicCode: "SSR010",
    specialNames: [
      "ヘッドハンター",
      "名将",
      "不動産神"
    ]
  },

{
    id: 791,
    name: "白鳥 セレナ",
    gender: "female",
    rarity: "SSR",
    leadership: 95,
    sales: 89,
    construction: 80,
    management: 70,
    salary: 106,
    graphicCode: "SSR011",
    specialNames: [
      "買い叩き",
      "名将",
      "不動産神"
    ]
  },

{
    id: 792,
    name: "橘川 レイラ",
    gender: "female",
    rarity: "SSR",
    leadership: 98,
    sales: 69,
    construction: 77,
    management: 76,
    salary: 80,
    graphicCode: "SSR012",
    specialNames: [
      "お客様第一",
      "名将",
      "不動産神"
    ]
  },

{
    id: 793,
    name: "アリアノート・アークライト",
    gender: "female",
    rarity: "SSR",
    leadership: 85,
    sales: 83,
    construction: 78,
    management: 67,
    salary: 80,
    graphicCode: "SSR013",
    specialNames: [
      "名将",
      "お客様第一",
      "不動産神"
    ]
  },

{
    id: 794,
    name: "オフィーリア・ヴァレンタイン",
    gender: "female",
    rarity: "SSR",
    leadership: 93,
    sales: 94,
    construction: 85,
    management: 91,
    salary: 132,
    graphicCode: "SSR014",
    specialNames: [
      "熱血上司",
      "伝説の営業マン",
      "不動産神"
    ]
  },

{
    id: 795,
    name: "エヴァンジェリン・ローゼン",
    gender: "female",
    rarity: "SSR",
    leadership: 68,
    sales: 66,
    construction: 92,
    management: 93,
    salary: 86,
    graphicCode: "SSR015",
    specialNames: [
      "管理の達人",
      "家賃回収人",
      "地方創生"
    ]
  },

{
    id: 896,
    name: "天海 美空",
    gender: "female",
    rarity: "UR",
    leadership: 86,
    sales: 88,
    construction: 97,
    management: 98,
    salary: 110,
    graphicCode: "UR001",
    specialNames: [
      "巡回名人",
      "リーダー",
      "修繕の匠",
      "地価予言者"
    ]
  },

{
    id: 897,
    name: "瑞原 深雪",
    gender: "female",
    rarity: "UR",
    leadership: 100,
    sales: 82,
    construction: 89,
    management: 105,
    salary: 110,
    graphicCode: "UR002",
    specialNames: [
      "家賃回収人",
      "お客様第一",
      "品質第一",
      "野口コーポレーション創業者"
    ]
  },

{
    id: 898,
    name: "篠原 瑠璃",
    gender: "female",
    rarity: "UR",
    leadership: 87,
    sales: 97,
    construction: 91,
    management: 96,
    salary: 115,
    graphicCode: "UR003",
    specialNames: [
      "品質第一",
      "カリスマ営業",
      "一級建築士",
      "伝説の再生王"
    ]
  },

{
    id: 899,
    name: "黒羽 美亜",
    gender: "female",
    rarity: "UR",
    leadership: 82,
    sales: 99,
    construction: 96,
    management: 108,
    salary: 135,
    graphicCode: "UR004",
    specialNames: [
      "熱血上司",
      "品質第一",
      "カリスマ所長",
      "伝説の再生王",
    ]
  },

{
    id: 900,
    name: "アメリア・セレスティア",
    gender: "female",
    rarity: "UR",
    leadership: 97,
    sales: 95,
    construction: 92,
    management: 98,
    salary: 139,
    graphicCode: "UR005",
    specialNames: [
      "リーダー",
      "巡回名人",
      "賃貸王",
      "野口コーポレーション創業者"
    ]
  }
];


const MAX_EMPLOYEES_PER_OFFICE = 10;
const EMPLOYEE_RECRUITMENT_ENVELOPE_COUNT = 5;
const EMPLOYEE_AWAKENING_MAX = 5;
const BRANCH_OFFICE_COST = 10000;
const BRANCH_OFFICE_BASE_MONTHS = 6;
const HQ_ACTION_RANGE = 10;
const BRANCH_ACTION_RANGE = 10;
const OFFICE_MIN_DISTANCE = 0;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function getNearestPointDistance(x, y, points, fallbackX, fallbackY) {
  if (Array.isArray(points) && points.length > 0) {
    return Math.min(
      ...points.map((point) => getDistance(x, y, point.x, point.y))
    );
  }

  return getDistance(x, y, fallbackX, fallbackY);
}



function isBuildableTile(tile) {
  return tile.terrain === TERRAIN.PLAIN && tile.feature === FEATURE.NONE;
}

function calculateLandPrice(
  x,
  y,
  terrain,
  feature,
  stationX,
  stationY,
  schoolX,
  schoolY,
  factoryX,
  factoryY
) {
  const stationDistance = getNearestPointDistance(x, y, stationX, stationX, stationY);
  const schoolDistance = getNearestPointDistance(x, y, schoolX, schoolX, schoolY);
  const factoryDistance = getDistance(x, y, factoryX, factoryY);

  let price = 500;

  price += Math.max(0, 12000 - stationDistance * 1200);
  price += Math.max(0, 1800 - schoolDistance * 180);
  price += Math.max(0, 1200 - factoryDistance * 120);

  if (feature === FEATURE.ROAD) price += 500;
  if (feature === FEATURE.STATION) price += 3000;
  if (feature === FEATURE.SCHOOL) price += 800;
  if (feature === FEATURE.FACTORY) price += 500;

  if (terrain === TERRAIN.MOUNTAIN) price = 200;
  if (terrain === TERRAIN.RIVER) price = 300;
  if (terrain === TERRAIN.SEA) price = 400;

  return Math.round(price);
}
function getZone(x, y, stationX, stationY, schoolX, schoolY, factoryX, factoryY) {
  const stationDistance = getNearestPointDistance(x, y, stationX, stationX, stationY);
  const schoolDistance = getNearestPointDistance(x, y, schoolX, schoolX, schoolY);
  const factoryDistance = getDistance(x, y, factoryX, factoryY);

  if (stationDistance <= 4) return ZONE.COMMERCIAL;
  if (factoryDistance <= 4) return ZONE.INDUSTRIAL;
  if (schoolDistance <= 5) return ZONE.RESIDENTIAL;

  return ZONE.GENERAL;
}

function createRooms(buildingKey, demand, currentMonth = 0) {
  const building = BUILDINGS[buildingKey];

  return Array.from({ length: building.rooms }, (_, index) => {
    const shouldOccupy = Math.random() * 100 < demand * 0.55;

    if (!shouldOccupy) {
      return {
        roomNo: index + 1,
        tenantType: null,
        people: 0,
        rent: building.baseRent,
        contractRent: null,
        contractStartMonth: null,
        lastRentReviewMonth: null,
        occupied: false,
        tenantMonths: 0,
      };
    }

    const tenantKey =
      building.allowedTenants[randomInt(0, building.allowedTenants.length - 1)];
    const tenant = TENANT_TYPES[tenantKey];
    const people = randomInt(tenant.peopleMin, tenant.peopleMax);
    const rent = Math.round(building.baseRent * tenant.rentPower);

    return {
      roomNo: index + 1,
      tenantType: tenantKey,
      people,
      rent,
      contractRent: rent,
      contractStartMonth: currentMonth,
      lastRentReviewMonth: currentMonth,
      occupied: true,
      tenantMonths: 0,
    };
  });
}

function pickRivalInitialEmployee() {
  const rarityRoll = Math.random() * 100;
  let targetRarities = ["N"];

  if (rarityRoll < 0.3) {
    targetRarities = ["UR"];
  } else if (rarityRoll < 1.3) {
    targetRarities = ["SSR"];
  } else if (rarityRoll < 6.3) {
    targetRarities = ["SR"];
  } else if (rarityRoll < 16.3) {
    targetRarities = ["HR"];
  } else if (rarityRoll < 38.3) {
    targetRarities = ["R"];
  }

  let pool = EMPLOYEE_POOL.filter((employee) => {
    return targetRarities.includes(employee.rarity);
  });

  if (pool.length === 0) {
    pool = EMPLOYEE_POOL;
  }

const picked = pool[randomInt(0, pool.length - 1)];

return {
  ...picked,
  baseLeadership: picked.baseLeadership ?? picked.leadership ?? 0,
  baseSales: picked.baseSales ?? picked.sales ?? 0,
  baseConstruction: picked.baseConstruction ?? picked.construction ?? 0,
  baseManagement: picked.baseManagement ?? picked.management ?? 0,
  baseSalary: picked.baseSalary ?? picked.salary ?? 0,
  level: picked.level ?? 1,
  exp: picked.exp ?? 0,
  officeId: "rival_A_hq",
};
}

function isTileNearRoadOrRail(tile, tiles) {
  return tiles.some((otherTile) => {
    if (getDistance(tile.x, tile.y, otherTile.x, otherTile.y) !== 1) return false;
    return otherTile.feature === FEATURE.ROAD || otherTile.rail === true;
  });
}

function createMap() {
const seaSide = randomInt(0, 3);
const seaStart = randomInt(Math.floor(MAP_SIZE * 0.78), Math.floor(MAP_SIZE * 0.86));

function getCoastOffset(index) {
  return Math.round(Math.sin(index * 0.45) * 2);
}

function isSeaCoordinate(x, y) {
  const coastOffset =
    seaSide === 0 || seaSide === 1
      ? getCoastOffset(y)
      : getCoastOffset(x);

  return (
    (seaSide === 0 && x >= seaStart + coastOffset) ||
    (seaSide === 1 && x <= MAP_SIZE - seaStart + coastOffset) ||
    (seaSide === 2 && y >= seaStart + coastOffset) ||
    (seaSide === 3 && y <= MAP_SIZE - seaStart + coastOffset)
  );
}

function createRandomPoint(minDistance, usedPoints = []) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const point = {
      x: randomInt(5, MAP_SIZE - 12),
      y: randomInt(5, MAP_SIZE - 12),
    };

    if (isSeaCoordinate(point.x, point.y)) continue;

    const tooClose = usedPoints.some((usedPoint) => {
      return getDistance(point.x, point.y, usedPoint.x, usedPoint.y) < minDistance;
    });

    if (!tooClose) return point;
  }

  return {
    x: randomInt(5, MAP_SIZE - 12),
    y: randomInt(5, MAP_SIZE - 12),
  };
}

// V68：70×70マップに合わせて、道路を縦横それぞれ4本へ増加。
// 旧仕様は実質「縦2本・横2本」だったため、縦横各2本ずつ増やす。
const verticalRoadXs = [
  randomInt(6, 14),
  randomInt(18, 28),
  randomInt(32, 44),
  randomInt(48, 62),
];

const horizontalRoadYs = [
  randomInt(6, 14),
  randomInt(18, 28),
  randomInt(32, 44),
  randomInt(48, 62),
];

const firstRailVertical = seaSide === 0 || seaSide === 1;

// 1本目：海と平行に走るメイン線路。
// 海が左右にある時は縦線路、海が上下にある時は横線路にする。
const mainRailX = firstRailVertical
  ? seaSide === 1
    ? verticalRoadXs[3]
    : verticalRoadXs[0]
  : null;

const mainRailY = firstRailVertical
  ? null
  : seaSide === 3
    ? horizontalRoadYs[3]
    : horizontalRoadYs[0];

// 2本目：1本目と交差する線路。
// 海に向かう側は海へ突き抜けさせず、海から約5マス手前で止めて終端駅を置く。
const secondRailVertical = !firstRailVertical;
const secondRailX = secondRailVertical
  ? randomInt(8, MAP_SIZE - 12)
  : null;
const secondRailY = secondRailVertical
  ? null
  : randomInt(8, MAP_SIZE - 12);

const coastRailEndX =
  seaSide === 0
    ? Math.max(5, seaStart - 5)
    : seaSide === 1
      ? Math.min(MAP_SIZE - 6, MAP_SIZE - seaStart + 5)
      : null;

const coastRailEndY =
  seaSide === 2
    ? Math.max(5, seaStart - 5)
    : seaSide === 3
      ? Math.min(MAP_SIZE - 6, MAP_SIZE - seaStart + 5)
      : null;

const railIntersection = firstRailVertical
  ? { x: mainRailX, y: secondRailY }
  : { x: secondRailX, y: mainRailY };

const coastalStation = firstRailVertical
  ? { x: coastRailEndX, y: secondRailY }
  : { x: secondRailX, y: coastRailEndY };

const stationPositions = [
  railIntersection,
  coastalStation,
];

const stationX = railIntersection.x;
const stationY = railIntersection.y;

function isMainRailCoordinate(x, y) {
  if (firstRailVertical) {
    return x === mainRailX && !isSeaCoordinate(x, y);
  }

  return y === mainRailY && !isSeaCoordinate(x, y);
}

function isSecondRailCoordinate(x, y) {
  if (secondRailVertical) {
    if (x !== secondRailX) return false;
    if (seaSide === 2) return y <= coastRailEndY && !isSeaCoordinate(x, y);
    if (seaSide === 3) return y >= coastRailEndY && !isSeaCoordinate(x, y);
    return !isSeaCoordinate(x, y);
  }

  if (y !== secondRailY) return false;
  if (seaSide === 0) return x <= coastRailEndX && !isSeaCoordinate(x, y);
  if (seaSide === 1) return x >= coastRailEndX && !isSeaCoordinate(x, y);
  return !isSeaCoordinate(x, y);
}

function isRailCoordinate(x, y) {
  return isMainRailCoordinate(x, y) || isSecondRailCoordinate(x, y);
}

const riverAnchor = randomInt(8, MAP_SIZE - 9);
const riverDelta = randomInt(-18, 18);

function getRiverCenterByX(x) {
  const inlandStartX = seaSide === 0 ? 2 : seaSide === 1 ? MAP_SIZE - 3 : null;
  const coastEndX = seaSide === 0
    ? Math.max(4, seaStart - 1)
    : seaSide === 1
      ? Math.min(MAP_SIZE - 5, MAP_SIZE - seaStart + 1)
      : null;

  if (inlandStartX === null || coastEndX === null) return null;
  const progress = Math.max(0, Math.min(1, Math.abs(x - inlandStartX) / Math.max(1, Math.abs(coastEndX - inlandStartX))));
  return Math.round(riverAnchor + riverDelta * progress + Math.sin(x * 0.35) * 1.5);
}

function getRiverCenterByY(y) {
  const inlandStartY = seaSide === 2 ? 2 : seaSide === 3 ? MAP_SIZE - 3 : null;
  const coastEndY = seaSide === 2
    ? Math.max(4, seaStart - 1)
    : seaSide === 3
      ? Math.min(MAP_SIZE - 5, MAP_SIZE - seaStart + 1)
      : null;

  if (inlandStartY === null || coastEndY === null) return null;
  const progress = Math.max(0, Math.min(1, Math.abs(y - inlandStartY) / Math.max(1, Math.abs(coastEndY - inlandStartY))));
  return Math.round(riverAnchor + riverDelta * progress + Math.sin(y * 0.35) * 1.5);
}

function isRiverCoordinate(x, y) {
  if (isSeaCoordinate(x, y)) return false;

  if (seaSide === 0 || seaSide === 1) {
    const centerY = getRiverCenterByX(x);
    if (centerY === null) return false;
    const coastEndX = seaSide === 0 ? Math.max(4, seaStart - 1) : Math.min(MAP_SIZE - 5, MAP_SIZE - seaStart + 1);
    const inRiverLength = seaSide === 0 ? x <= coastEndX : x >= coastEndX;
    return inRiverLength && Math.abs(y - centerY) <= 0;
  }

  const centerX = getRiverCenterByY(y);
  if (centerX === null) return false;
  const coastEndY = seaSide === 2 ? Math.max(4, seaStart - 1) : Math.min(MAP_SIZE - 5, MAP_SIZE - seaStart + 1);
  const inRiverLength = seaSide === 2 ? y <= coastEndY : y >= coastEndY;
  return inRiverLength && Math.abs(x - centerX) <= 0;
}

function isRoadCoordinate(x, y) {
  return verticalRoadXs.includes(x) || horizontalRoadYs.includes(y);
}

function isReservedFacilityCoordinate(x, y) {
  if (isSeaCoordinate(x, y)) return true;
  if (isRiverCoordinate(x, y)) return true;
  if (isRoadCoordinate(x, y)) return true;
  if (isRailCoordinate(x, y)) return true;
  if (stationPositions.some((station) => station.x === x && station.y === y)) return true;

  return false;
}

function createFacilityPoint(minDistance, usedPoints = []) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const point = {
      x: randomInt(5, MAP_SIZE - 12),
      y: randomInt(5, MAP_SIZE - 12),
    };

    if (isReservedFacilityCoordinate(point.x, point.y)) continue;

    const tooClose = usedPoints.some((usedPoint) => {
      return getDistance(point.x, point.y, usedPoint.x, usedPoint.y) < minDistance;
    });

    if (!tooClose) return point;
  }

  for (let y = 5; y < MAP_SIZE - 5; y++) {
    for (let x = 5; x < MAP_SIZE - 5; x++) {
      if (isReservedFacilityCoordinate(x, y)) continue;

      const tooClose = usedPoints.some((usedPoint) => {
        return getDistance(x, y, usedPoint.x, usedPoint.y) < minDistance;
      });

      if (!tooClose) return { x, y };
    }
  }

  return { x: 5, y: 5 };
}

function getSchoolBlockTiles(topLeft) {
  return [
    { x: topLeft.x, y: topLeft.y },
    { x: topLeft.x + 1, y: topLeft.y },
    { x: topLeft.x, y: topLeft.y + 1 },
    { x: topLeft.x + 1, y: topLeft.y + 1 },
  ];
}

function canPlaceSchoolBlock(topLeft, usedPoints = [], minDistance = 8) {
  const blockTiles = getSchoolBlockTiles(topLeft);

  if (blockTiles.some((point) => point.x < 0 || point.x >= MAP_SIZE || point.y < 0 || point.y >= MAP_SIZE)) {
    return false;
  }

  if (blockTiles.some((point) => isReservedFacilityCoordinate(point.x, point.y))) {
    return false;
  }

  const tooClose = usedPoints.some((usedPoint) => {
    return blockTiles.some((point) => getDistance(point.x, point.y, usedPoint.x, usedPoint.y) < minDistance);
  });

  return !tooClose;
}

function createSchoolBlockPoint(minDistance, usedPoints = []) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const point = {
      x: randomInt(5, MAP_SIZE - 13),
      y: randomInt(5, MAP_SIZE - 13),
    };

    if (canPlaceSchoolBlock(point, usedPoints, minDistance)) return point;
  }

  for (let y = 5; y < MAP_SIZE - 6; y++) {
    for (let x = 5; x < MAP_SIZE - 6; x++) {
      const point = { x, y };
      if (canPlaceSchoolBlock(point, usedPoints, minDistance)) return point;
    }
  }

  return { x: 5, y: 5 };
}

// v79方針：学校は1マスでは小さすぎるため、2×2の4マス施設として配置する。
// ユーザー指示により、学校4マスのどのマスも海・川・道路・線路・駅に重ならないようにしている。
// 工場も従来通り、海・川・道路・線路・駅・学校に重ならない場所へ先に確定する。
const schoolCount = randomInt(4, 6);
const schoolBlocks = [];
const schoolPositions = [];
for (let i = 0; i < schoolCount; i++) {
  const schoolTopLeft = createSchoolBlockPoint(8, schoolPositions);
  const schoolTiles = getSchoolBlockTiles(schoolTopLeft);
  schoolBlocks.push({ topLeft: schoolTopLeft, tiles: schoolTiles });
  schoolPositions.push(...schoolTiles);
}

const schoolX = schoolPositions[0]?.x ?? 5;
const schoolY = schoolPositions[0]?.y ?? 5;

const factoryPoint = createFacilityPoint(10, [...stationPositions, ...schoolPositions]);
const factoryX = factoryPoint.x;
const factoryY = factoryPoint.y;

  const tiles = [];

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
     let terrain = TERRAIN.PLAIN;

// 山
if (
  (x < randomInt(2, 5) && y < randomInt(2, 8)) ||
  (x > MAP_SIZE - 20 && y < 8 && Math.random() < 0.7)
) {
  terrain = TERRAIN.MOUNTAIN;
}

// 川
if (isRiverCoordinate(x, y)) {
  terrain = TERRAIN.RIVER;
}

// 海
if (isSeaCoordinate(x, y)) {
  terrain = TERRAIN.SEA;
}

let feature = FEATURE.NONE;

// 道路
if (
  verticalRoadXs.includes(x) ||
  horizontalRoadYs.includes(y)
) {
  feature = FEATURE.ROAD;
}

// 線路
let rail = isRailCoordinate(x, y);

// 駅
if (stationPositions.some((station) => station.x === x && station.y === y)) {
  feature = FEATURE.STATION;
  rail = true;
}

// 学校
if (schoolPositions.some((school) => school.x === x && school.y === y)) {
  terrain = TERRAIN.PLAIN;
  feature = FEATURE.SCHOOL;
  rail = false;
}

// 工場
if (x === factoryX && y === factoryY) {
  terrain = TERRAIN.PLAIN;
  feature = FEATURE.FACTORY;
  rail = false;
}
// 海・川・山には道路や線路などを置かない
// 海と山だけは通れない
if (
  terrain === TERRAIN.MOUNTAIN ||
  terrain === TERRAIN.SEA
) {
  feature = FEATURE.NONE;
  rail = false;
}
      const landPrice = calculateLandPrice(
  x,
  y,
  terrain,
  feature,
  stationPositions,
  null,
  schoolPositions,
  null,
  factoryX,
  factoryY
);
      const zone = getZone(
  x,
  y,
  stationPositions,
  null,
  schoolPositions,
  null,
  factoryX,
  factoryY
);
      let owner = OWNER.OTHER;
      let building = null;
      let rooms = [];
      let age = 0;
　　　　let condition = 100;
      let buildingMainId = null;

      if (terrain !== TERRAIN.PLAIN || feature !== FEATURE.NONE) {
        owner = OWNER.PUBLIC;
      } else {
        const stationDistance = getNearestPointDistance(x, y, stationPositions, stationX, stationY);
        const schoolDistance = getNearestPointDistance(x, y, schoolPositions, schoolX, schoolY);

        if (stationDistance < 6 && Math.random() < 0.22) {
  building = Math.random() < 0.7 ? "house_2f" : "apt_2f_single";
  rooms = createRooms(building, 70, 0);
  age = randomInt(1, 25);
  condition = Math.max(40, 100 - age * randomInt(1, 3));
}

        if (!building && schoolDistance < 5 && Math.random() < 0.15) {
  building = "house_2f";
  rooms = createRooms(building, 75, 0);
  age = randomInt(1, 25);
  condition = Math.max(40, 100 - age * randomInt(1, 3));
}

        if (!building && Math.random() < 0.24) {
          owner = OWNER.SALE;
        }
      }

      tiles.push({
        id: y * MAP_SIZE + x,
        x,
        y,
        terrain,
        feature,
rail,
zone,
owner,
building,
        buildingMainId,
rooms,
age,
condition,
vacancyMonths: 0,
recoveryMode: false,
landPrice,
      });
    }
  }

function getRivalOfficeCandidates(minDistanceFromPlaced = 0, placedRivalOffices = [], requireRoadOrRail = true) {
  return tiles.filter((tile) => {
    if (tile.terrain !== TERRAIN.PLAIN) return false;
    if (tile.feature !== FEATURE.NONE) return false;
    if (tile.building) return false;
    if (tile.owner === OWNER.PUBLIC) return false;
    if (tile.owner === OWNER.RIVAL) return false;
    if (requireRoadOrRail && !isTileNearRoadOrRail(tile, tiles)) return false;

    return placedRivalOffices.every((placedTile) => {
      return getDistance(tile.x, tile.y, placedTile.x, placedTile.y) >= minDistanceFromPlaced;
    });
  });
}

const placedRivalOffices = [];
const initialRivalCompanyNames = pickRandomRivalCompanyNames(INITIAL_RIVAL_COMPANY_IDS.length);
INITIAL_RIVAL_COMPANY_IDS.forEach((companyId, index) => {
  const company = getRivalCompany(companyId);
  const companyName = initialRivalCompanyNames[index] ?? company.name;
  const strictCandidates = getRivalOfficeCandidates(15, placedRivalOffices, true);
  const looseDistanceCandidates = getRivalOfficeCandidates(10, placedRivalOffices, true);
  const fallbackCandidates = getRivalOfficeCandidates(15, placedRivalOffices, false);
  const candidatePool = strictCandidates.length > 0
    ? strictCandidates
    : looseDistanceCandidates.length > 0
      ? looseDistanceCandidates
      : fallbackCandidates;

  const rivalOfficeTile = candidatePool.length > 0
    ? candidatePool[randomInt(0, candidatePool.length - 1)]
    : null;

  if (!rivalOfficeTile) return;

  const rivalEmployee = {
    ...pickRivalInitialEmployee(),
    officeId: `rival_${company.id}_hq`,
  };
  rivalOfficeTile.owner = OWNER.RIVAL;
  rivalOfficeTile.feature = FEATURE.HQ;
  rivalOfficeTile.building = null;
  rivalOfficeTile.rivalCompanyId = company.id;
  rivalOfficeTile.rivalCompanyName = companyName;
  rivalOfficeTile.rivalOfficeName = `${companyName} 本社`;
  rivalOfficeTile.rivalEmployees = [rivalEmployee];
  rivalOfficeTile.rivalMoney = company.initialMoney;
  placedRivalOffices.push(rivalOfficeTile);
});

return {
  tiles,
  stationX,
  stationY,
  stationPositions,
  schoolX,
  schoolY,
  schoolPositions,
  factoryX,
  factoryY,
};
}

function getTerrainName(terrain) {
  if (terrain === TERRAIN.PLAIN) return "平地";
  if (terrain === TERRAIN.MOUNTAIN) return "山";
  if (terrain === TERRAIN.RIVER) return "川";
  if (terrain === TERRAIN.SEA) return "海";
  return "不明";
}

function getFeatureName(feature) {
  if (feature === FEATURE.ROAD) return "道路";
  if (feature === FEATURE.STATION) return "駅";
  if (feature === FEATURE.SCHOOL) return "学校";
  if (feature === FEATURE.FACTORY) return "工場";
  if (feature === FEATURE.HQ) return "本社";
  if (feature === FEATURE.BRANCH) return "支店";
  return "なし";
}
function getZoneName(zone) {
  if (zone === ZONE.RESIDENTIAL) return "住宅地域";
  if (zone === ZONE.COMMERCIAL) return "商業地域";
  if (zone === ZONE.INDUSTRIAL) return "工業地域";
  return "一般地域";
}

function getOwnerName(owner) {
  if (owner === OWNER.PLAYER) return "自分";
  if (owner === OWNER.SALE) return "売り物件";
  if (owner === OWNER.OTHER) return "他人";
  if (owner === OWNER.PUBLIC) return "公共・自然";
  if (owner === OWNER.RIVAL) return "ライバル企業";

  return "不明";
}

function getGameDate(month) {
  const startMonth = 4;
  const totalMonths = startMonth + month - 2;

  const year = Math.floor(totalMonths / 12) + 1;
  const displayMonth = (totalMonths % 12) + 1;

  return {
    year,
    month: displayMonth,
    label: `${year}年目${displayMonth}月`,
  };
}

function getSeasonDemandBonus(gameMonth, buildingKey) {
  const building = BUILDINGS[buildingKey];
  if (!building) return 0;

  if (
    building.category === "住宅" ||
    building.category === "住宅" ||
    building.category === "住宅"
  ) {
    if (gameMonth === 2) return 5;
    if (gameMonth === 3 || gameMonth === 4) return 12;
    if (gameMonth === 9 || gameMonth === 10) return 4;
    if (gameMonth === 11 || gameMonth === 12 || gameMonth === 1) return -6;
  }

  if (building.category === "商業") {
    if (gameMonth === 12) return 8;
    if (gameMonth === 3 || gameMonth === 4) return 5;
    if (gameMonth === 1 || gameMonth === 2) return -3;
  }

  return 0;
}
function calculateBuildingValue(tile) {
  if (!tile || !tile.building) return 0;

  const building = BUILDINGS[tile.building];
  if (!building) return 0;

  const age = tile.age ?? 0;
  const condition = tile.condition ?? 100;

  const ageRate = Math.max(0.2, 1 - age / building.lifeYears);
  const conditionRate = condition / 100;

  return Math.round(building.cost * ageRate * conditionRate);
}
function calculateMonthlyExpenses(tile) {
  if (!tile?.building) return 0;

  const building = BUILDINGS[tile.building];
  if (!building) return 0;

  const occupiedRent = tile.rooms.reduce((sum, room) => {
    return sum + (room.occupied ? room.rent : 0);
  }, 0);

  const managementFee = occupiedRent * 0.05;
  const insurance = building.cost * 0.002 / 12;
  const repairReserve = building.cost * 0.006 / 12;

  return Math.round(
    managementFee +
    insurance +
    repairReserve
  );
}

function calculateYearlyPropertyTax(tile) {
  if (!tile || tile.owner !== OWNER.PLAYER) return 0;

  const landTax = tile.landPrice * 0.014;

  const buildingTax =
    tile.building && !tile.buildingMainId
      ? calculateBuildingValue(tile) * 0.014
      : 0;

  return Math.round(landTax + buildingTax);
}

function calculateCompanyYearlyPropertyTax(tile) {
  if (!tile) return 0;

  const landTax = (tile.landPrice ?? 0) * 0.014;

  const buildingTax =
    tile.building && !tile.buildingMainId
      ? calculateBuildingValue(tile) * 0.014
      : 0;

  return Math.round(landTax + buildingTax);
}
function getOldBuildingActionChance(tile) {
  if (!tile?.building) return null;

  const building = BUILDINGS[tile.building];
  const age = tile.age ?? 0;
  const condition = tile.condition ?? 100;
  const life = building.lifeYears;

  if (age < life * 0.9) return null;

  let sellChance = 0.002;
  let demolishChance = 0.001;

  if (age >= life) {
    sellChance += 0.006;
    demolishChance += 0.004;
  }

  if (age >= life * 1.3) {
    sellChance += 0.008;
    demolishChance += 0.008;
  }

  if (condition < 50) {
    sellChance += 0.006;
    demolishChance += 0.006;
  }

  return {
    sellChance,
    demolishChance,
  };
}

function loadSavedGameSafely() {
  if (typeof window === "undefined") return null;

  const currentSlot = getCurrentSaveSlot();
  const currentSlotSave = readSaveSlot(currentSlot);
  if (currentSlotSave) return currentSlotSave;

  const firstSlotSave = readSaveSlot(DEFAULT_SAVE_SLOT);
  if (firstSlotSave) return firstSlotSave;

  try {
    const rawSaveData = window.localStorage.getItem("realEstateGameSave");
    if (!rawSaveData) return null;

    const parsedSaveData = JSON.parse(rawSaveData);
    if (!parsedSaveData || typeof parsedSaveData !== "object") return null;
    if (!Array.isArray(parsedSaveData.tiles)) return null;

    return parsedSaveData;
  } catch (error) {
    console.warn("Save data could not be loaded. Starting with a safe new map.", error);
    return null;
  }
}

export default function App() {

  useEffect(() => {
    document.title = "箱庭不動産経営シミュレーター V109";

    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });
    });
  }, []);
 const savedGame = loadSavedGameSafely();

const initialMap = savedGame ?? createMap();
const loadedHqPlaced = Boolean(
  savedGame?.hqPlaced ||
    initialMap.tiles?.some((tile) => tile.owner === OWNER.PLAYER && tile.feature === FEATURE.HQ)
);

const [money, setMoney] = useState(savedGame?.money ?? 20000);
const [loans, setLoans] = useState(() => (savedGame?.loans ?? []).map(normalizeLoan));
const [pendingLoanApplications, setPendingLoanApplications] = useState(() => {
  return (savedGame?.pendingLoanApplications ?? [])
    .map(normalizePendingLoanApplication)
    .filter(Boolean);
});
const [pendingLoanConsultations, setPendingLoanConsultations] = useState(() => {
  return (savedGame?.pendingLoanConsultations ?? [])
    .map(normalizePendingLoanConsultation)
    .filter(Boolean);
});
const [loanConsultationReports, setLoanConsultationReports] = useState(() => {
  const currentMonthForReports = savedGame?.month ?? 1;
  return (savedGame?.loanConsultationReports ?? [])
    .map(normalizeLoanConsultationReport)
    .filter(Boolean)
    .map((report) => ({
      ...report,
      createdMonth: report.createdMonth ?? currentMonthForReports,
      expiresMonth: report.expiresMonth ?? currentMonthForReports + 6,
    }))
    .filter((report) => report.used !== true)
    .filter((report) => currentMonthForReports < report.expiresMonth)
    .slice(0, 12);
});
const [loanAmountInput, setLoanAmountInput] = useState("5000");
const [consultationApplicationAmounts, setConsultationApplicationAmounts] = useState({});
const [selectedBankId, setSelectedBankId] = useState("regional");
const [month, setMonth] = useState(savedGame?.month ?? 1);
const [hqPlaced, setHqPlaced] = useState(loadedHqPlaced);

const [tiles, setTiles] = useState(initialMap.tiles);
const [employees, setEmployees] = useState(() => {
  const savedEmployees = savedGame?.employees ?? [];

  return savedEmployees
    .filter((employee) => employee.id !== 0)
    .map((employee) => normalizeEmployeeGrowthBase({
      ...employee,
      officeId: employee.officeId ?? "hq",
    }));
});

const employeesRef = useRef([]);

useEffect(() => {
  employeesRef.current = employees;
}, [employees]);

const [employeeCandidates, setEmployeeCandidates] = useState(
  savedGame?.employeeCandidates ?? []
);

const [employeeStorage, setEmployeeStorage] = useState(() => {
  const savedStorage = savedGame?.employeeStorage ?? [];

  return savedStorage
    .filter((employee) => employee.id !== 0)
    .map((employee) => normalizeEmployeeGrowthBase({
      ...employee,
      officeId: null,
    }));
});

const [employeeTickets, setEmployeeTickets] = useState(
  savedGame?.employeeTickets ?? 1
);

const [premiumEmployeeTickets, setPremiumEmployeeTickets] = useState(
  savedGame?.premiumEmployeeTickets ?? 0
);

const [employeeSortKey, setEmployeeSortKey] = useState(
  savedGame?.employeeSortKey ?? "rarity"
);

const [employeeSortDirection, setEmployeeSortDirection] = useState(
  savedGame?.employeeSortDirection ?? "desc"
);

useEffect(() => {
  setEmployees((currentEmployees) => {
    return currentEmployees
      .filter((employee) => employee.id !== 0)
      .map((employee) => normalizeEmployeeGrowthBase({
        ...employee,
        officeId: employee.officeId ?? "hq",
      }));
  });
}, []);

useEffect(() => {
  const hasPlayerHQ = tiles.some((tile) => {
    return tile.owner === OWNER.PLAYER && tile.feature === FEATURE.HQ;
  });

  if (hasPlayerHQ && !hqPlaced) {
    setHqPlaced(true);
    setActionPoints((current) => Math.max(current, 1));
    setActivePanel((currentPanel) => currentPanel === "hq" ? "home" : currentPanel);
  }
}, [tiles, hqPlaced]);

const [actionPoints, setActionPoints] = useState(
  savedGame?.actionPoints ?? (loadedHqPlaced ? 1 : 0)
);

const [stationPos] = useState(() => {
  const stationTile = initialMap.tiles.find(
    (tile) => tile.feature === FEATURE.STATION
  );

  return {
    x: initialMap.stationX ?? stationTile?.x ?? 14,
    y: initialMap.stationY ?? stationTile?.y ?? 10,
  };
});

const [stationPositions] = useState(() => {
  if (Array.isArray(initialMap.stationPositions) && initialMap.stationPositions.length > 0) {
    return initialMap.stationPositions;
  }

  return initialMap.tiles
    .filter((tile) => tile.feature === FEATURE.STATION)
    .map((tile) => ({ x: tile.x, y: tile.y }));
});

const [schoolPos] = useState(() => {
  const schoolTile = initialMap.tiles.find(
    (tile) => tile.feature === FEATURE.SCHOOL
  );

  return {
    x: initialMap.schoolX ?? schoolTile?.x ?? 8,
    y: initialMap.schoolY ?? schoolTile?.y ?? 8,
  };
});

const [schoolPositions] = useState(() => {
  if (Array.isArray(initialMap.schoolPositions) && initialMap.schoolPositions.length > 0) {
    return initialMap.schoolPositions;
  }

  return initialMap.tiles
    .filter((tile) => tile.feature === FEATURE.SCHOOL)
    .map((tile) => ({ x: tile.x, y: tile.y }));
});

const [factoryPos] = useState(() => {
  const factoryTile = initialMap.tiles.find(
    (tile) => tile.feature === FEATURE.FACTORY
  );

  return {
    x: initialMap.factoryX ?? factoryTile?.x ?? 20,
    y: initialMap.factoryY ?? factoryTile?.y ?? 20,
  };
});

const [factoryProjects, setFactoryProjects] = useState([]);
const [stationProjects, setStationProjects] = useState([]);
const [selectedId, setSelectedId] = useState(savedGame?.selectedId ?? null);
const [log, setLog] = useState(
  savedGame?.log ?? "売り物件を探して、土地を購入しましょう。"
);
const [logHistory, setLogHistory] = useState((savedGame?.logHistory ?? []).slice(0, 200));
const [playerRank, setPlayerRank] = useState(savedGame?.playerRank ?? 1);
const [playerExp, setPlayerExp] = useState(savedGame?.playerExp ?? 0);
const playerRankRef = useRef(savedGame?.playerRank ?? 1);
const playerExpRef = useRef(savedGame?.playerExp ?? 0);

useEffect(() => {
  playerRankRef.current = playerRank;
  playerExpRef.current = playerExp;
}, [playerRank, playerExp]);

const [popupLog, setPopupLog] = useState(null);
const [annualReport, setAnnualReport] = useState(null);
const [annualStats, setAnnualStats] = useState(savedGame?.annualStats ?? { income: 0, maintenance: 0, tax: 0, purchase: 0, net: 0 });
const [monthlyCompanyHistory, setMonthlyCompanyHistory] = useState(savedGame?.monthlyCompanyHistory ?? []);
const [annualReportHistory, setAnnualReportHistory] = useState(savedGame?.annualReportHistory ?? []);
const [isDemoMode, setIsDemoMode] = useState(savedGame?.isDemoMode ?? false);
const [playerCompanyName, setPlayerCompanyName] = useState(savedGame?.playerCompanyName ?? DEFAULT_COMPANY_NAME);
const [activeSaveSlot, setActiveSaveSlot] = useState(savedGame?.activeSaveSlot ?? getCurrentSaveSlot());
const [saveSlotRefreshKey, setSaveSlotRefreshKey] = useState(0);
const [newCompanyNameInput, setNewCompanyNameInput] = useState(savedGame?.playerCompanyName ?? DEFAULT_COMPANY_NAME);
const [usedSecretCommands, setUsedSecretCommands] = useState(savedGame?.usedSecretCommands ?? {});
const [showDeveloperCommand, setShowDeveloperCommand] = useState(false);
const [developerCommandInput, setDeveloperCommandInput] = useState("");
const [playerRankUpResult, setPlayerRankUpResult] = useState(null);
const [ticketRewardResult, setTicketRewardResult] = useState(null);
const [selectedCompanyDetail, setSelectedCompanyDetail] = useState(null);
const [companyEmployeeListModal, setCompanyEmployeeListModal] = useState(null);
const [companyBuildingListModal, setCompanyBuildingListModal] = useState(null);
const [companySortKey, setCompanySortKey] = useState("asset");
const [companySortDirection, setCompanySortDirection] = useState("desc");

const [employeeGachaResult, setEmployeeGachaResult] = useState(null);
const [employeeRecruitmentOffer, setEmployeeRecruitmentOffer] = useState(null);
const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
const [employeeLibraryFilter, setEmployeeLibraryFilter] = useState("ALL");
const [actionEmployeeRequest, setActionEmployeeRequest] = useState(null);
const [actionEmployeeSelectionIds, setActionEmployeeSelectionIds] = useState([]);
const [employeeLevelUpResult, setEmployeeLevelUpResult] = useState(null);

const bgmRef = useRef(null);
const [isBgmOn, setIsBgmOn] = useState(false);
const mapScrollRef = useRef(null);
const mapDragStateRef = useRef({
  isPointerDown: false,
  isDragging: false,
  moved: false,
  startX: 0,
  startY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  lastDragEndedAt: 0,
});

useEffect(() => {
  if (!bgmRef.current) return;

  bgmRef.current.volume = 0.25;
  if (isBgmOn) {
    bgmRef.current.play().catch((error) => {
      console.warn("BGM playback was blocked by the browser:", error);
      setIsBgmOn(false);
    });
  } else {
    bgmRef.current.pause();
  }
}, [isBgmOn]);

useEffect(() => {
  // v82軽量化：翌月処理直後に複数stateが連続更新されても、
  // localStorage保存は短時間で1回にまとめる。ゲーム内容は削らない。
  const saveTimer = window.setTimeout(() => {
    const saveData = {
      playerCompanyName,
      activeSaveSlot,
      savedAt: new Date().toISOString(),
      money,
      loans,
      pendingLoanApplications,
      pendingLoanConsultations,
      loanConsultationReports,
      month,
      hqPlaced,
      tiles,
      selectedId,
      log,
      logHistory: logHistory.slice(0, 200),
      playerRank,
      playerExp,
      employees,
      employeeCandidates,
      employeeStorage,
      actionPoints,
      employeeTickets,
      premiumEmployeeTickets,
      employeeSortKey,
      employeeSortDirection,
      annualStats,
      monthlyCompanyHistory: monthlyCompanyHistory.slice(0, 120),
      annualReportHistory: annualReportHistory.slice(0, 30),
      isDemoMode,
      usedSecretCommands,
    };

    localStorage.setItem("realEstateGameCurrentSlot", String(activeSaveSlot));
    localStorage.setItem(getSaveSlotKey(activeSaveSlot), JSON.stringify(saveData));
    localStorage.setItem("realEstateGameSave", JSON.stringify(saveData));
    setSaveSlotRefreshKey((current) => current + 1);
  }, 250);

  return () => {
    window.clearTimeout(saveTimer);
  };
}, [
  playerCompanyName,
  activeSaveSlot,
  money,
  loans,
  pendingLoanApplications,
  pendingLoanConsultations,
  loanConsultationReports,
  month,
  hqPlaced,
  tiles,
  selectedId,
  log,
  logHistory,
  playerRank,
  playerExp,
  employees,
  employeeCandidates,
  employeeStorage,
  actionPoints,
  employeeTickets,
  premiumEmployeeTickets,
  employeeSortKey,
  employeeSortDirection,
  annualStats,
  monthlyCompanyHistory,
  annualReportHistory,
  isDemoMode,
  usedSecretCommands,
]);

const [tileSize, setTileSize] = useState(24);
const [activePanel, setActivePanel] = useState(loadedHqPlaced ? "home" : "hq");
const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
const [isMoneyInfoOpen, setIsMoneyInfoOpen] = useState(false);
const [isDateInfoOpen, setIsDateInfoOpen] = useState(false);
const DEFAULT_FLOATING_PANEL = { x: 18, y: 118, width: 420, height: 300 };
const [floatingPanel, setFloatingPanel] = useState(DEFAULT_FLOATING_PANEL);
const [floatingPanelResetKey, setFloatingPanelResetKey] = useState(0);
const floatingPanelDragRef = useRef(null);
const floatingPanelResizeRef = useRef(null);
const [showOptions, setShowOptions] = useState(false);
const [showTitleScreen, setShowTitleScreen] = useState(true);
const [titleModal, setTitleModal] = useState(null);
const [saveLoadModal, setSaveLoadModal] = useState(null);
const [selectedBuildCategory, setSelectedBuildCategory] = useState(null);
const [selectedHousingType, setSelectedHousingType] = useState(null);
const [mapViewMode, setMapViewMode] = useState("normal");
const [pendingBuildKey, setPendingBuildKey] = useState(null);
const [pendingBranchPlacement, setPendingBranchPlacement] = useState(false);
const detailRef = useRef(null);

function isFloatingPanelMode() {
  return activePanel === "hq" || activePanel === "land" || activePanel === "build";
}

function getDefaultFloatingPanel(panelName = activePanel) {
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const isSmallScreen = viewportWidth <= 600;

  const baseSize = panelName === "build"
    ? { width: 520, height: 420 }
    : panelName === "hq"
      ? { width: 420, height: 280 }
      : { width: 420, height: 300 };

  const width = isSmallScreen
    ? Math.max(280, Math.min(viewportWidth - 16, baseSize.width))
    : Math.max(300, Math.min(viewportWidth - 32, baseSize.width));
  const height = isSmallScreen
    ? Math.max(220, Math.min(Math.round(viewportHeight * 0.58), baseSize.height))
    : Math.max(220, Math.min(viewportHeight - 140, baseSize.height));

  return {
    x: isSmallScreen ? 8 : 18,
    y: isSmallScreen ? 96 : 118,
    width,
    height,
  };
}

function resetFloatingPanel() {
  setFloatingPanel(getDefaultFloatingPanel(activePanel));
  setFloatingPanelResetKey((current) => current + 1);
}

function closeFloatingPanel() {
  setActivePanel("home");
}

function getFloatingPanelTitle(panelName = activePanel) {
  if (panelName === "hq") return "本社設置";
  if (panelName === "land") return "土地・建物情報";
  if (panelName === "build") return "建設メニュー";
  if (panelName === "employee") return "社員管理";
  if (panelName === "employeeLibrary") return "社員図鑑";
  return "操作パネル";
}

function handleFloatingPanelPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (event.target.closest?.("button, input, select, textarea, a, .floating-panel-resize-handle")) return;
  event.preventDefault();
  event.stopPropagation();

  floatingPanelDragRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panelX: floatingPanel.x,
    panelY: floatingPanel.y,
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handleFloatingPanelPointerMove(event) {
  const drag = floatingPanelDragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();

  const nextX = drag.panelX + event.clientX - drag.startX;
  const nextY = drag.panelY + event.clientY - drag.startY;
  const maxX = Math.max(0, window.innerWidth - 160);
  const maxY = Math.max(0, window.innerHeight - 120);

  setFloatingPanel((current) => ({
    ...current,
    x: Math.max(0, Math.min(maxX, nextX)),
    y: Math.max(0, Math.min(maxY, nextY)),
  }));
}

function handleFloatingPanelPointerUp(event) {
  const drag = floatingPanelDragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();
  floatingPanelDragRef.current = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

function handleFloatingPanelResizePointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();

  floatingPanelResizeRef.current = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panelWidth: floatingPanel.width,
    panelHeight: floatingPanel.height,
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function handleFloatingPanelResizePointerMove(event) {
  const resize = floatingPanelResizeRef.current;
  if (!resize || resize.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();

  const minWidth = 280;
  const minHeight = 200;
  const maxWidth = Math.max(minWidth, window.innerWidth - floatingPanel.x - 12);
  const maxHeight = Math.max(minHeight, window.innerHeight - floatingPanel.y - 12);
  const nextWidth = resize.panelWidth + event.clientX - resize.startX;
  const nextHeight = resize.panelHeight + event.clientY - resize.startY;

  setFloatingPanel((current) => ({
    ...current,
    width: Math.max(minWidth, Math.min(maxWidth, nextWidth)),
    height: Math.max(minHeight, Math.min(maxHeight, nextHeight)),
  }));
}

function handleFloatingPanelResizePointerUp(event) {
  const resize = floatingPanelResizeRef.current;
  if (!resize || resize.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();
  floatingPanelResizeRef.current = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

  const selectedTile = tiles.find((tile) => tile.id === selectedId);
  const gameDate = getGameDate(month);

  function getMainTile(tile) {
    if (!tile) return null;
    if (!tile.buildingMainId) return tile;
    return tiles.find((t) => t.id === tile.buildingMainId);
  }
function getHQDistance(tile) {
  const hqTile = tiles.find((t) => t.owner === OWNER.PLAYER && t.feature === FEATURE.HQ);

  if (!tile || !hqTile) {
    return 999;
  }

  return getDistance(tile.x, tile.y, hqTile.x, hqTile.y);
}
const playerMainBuildings = useMemo(() => {
  return tiles.filter((tile) => {
    if (tile.owner !== OWNER.PLAYER) return false;
    if (tile.buildingMainId) return false;

    if (tile.feature === FEATURE.HQ) return true;
    if (tile.building) return true;

    return false;
  });
}, [tiles]);

const totalPopulation = useMemo(() => {
  return tiles.reduce((sum, tile) => {
    let population = 0;

    // 建物の実入居者
    if (tile.building && !tile.buildingMainId && tile.rooms) {
      population += tile.rooms.reduce((roomSum, room) => {
        return roomSum + (room.occupied ? room.people : 0);
      }, 0);
    }

    // 他人所有の既存住宅は、町の人口として推定加算
    if (tile.owner === OWNER.OTHER && tile.building && !tile.buildingMainId) {
      const building = BUILDINGS[tile.building];

      if (
        building.category === "住宅" ||
        building.category === "住宅" ||
        building.category === "住宅"
      ) {
        population += building.rooms * 2;
      }
    }

    // 駅は人口流入源
    if (tile.feature === FEATURE.STATION) {
      population += 300;
    }

    // 学校はファミリー人口の中心
    if (tile.feature === FEATURE.SCHOOL) {
      population += 180;
    }

    // 工場は雇用人口
    if (tile.feature === FEATURE.FACTORY) {
      population += 220;
    }

    return sum + population;
  }, 0);
}, [tiles]);
const cityDemandIndex = useMemo(() => {
  const mainBuildings = tiles.filter(
    (tile) => tile.building && !tile.buildingMainId
  );

  const commercialCount = mainBuildings.filter((tile) => {
    return BUILDINGS[tile.building]?.category === "商業";
  }).length;

  const factoryCount = tiles.filter(
    (tile) => tile.feature === FEATURE.FACTORY
  ).length;

  const stationCount = tiles.filter(
    (tile) => tile.feature === FEATURE.STATION
  ).length;

  const vacantRooms = mainBuildings.reduce((sum, tile) => {
    if (!tile.rooms) return sum;

    return (
      sum +
      tile.rooms.filter((room) => !room.occupied).length
    );
  }, 0);

  let index = 50;

  index += Math.floor(totalPopulation / 40);
  index += commercialCount * 2;
  index += factoryCount * 3;
  index += stationCount * 5;
  index -= Math.floor(vacantRooms / 3);

  return Math.max(30, Math.min(100, index));
}, [tiles, totalPopulation]);
const demandByCategory = useMemo(() => {
  const mainBuildings = tiles.filter(
    (tile) => tile.building && !tile.buildingMainId
  );

  const housingCount = mainBuildings.filter((tile) => {
    const category = BUILDINGS[tile.building]?.category;
    return (
      category === "住宅" ||
      category === "住宅" ||
      category === "住宅"
    );
  }).length;

  const commercialCount = mainBuildings.filter((tile) => {
    return BUILDINGS[tile.building]?.category === "商業";
  }).length;

  const factoryCount = tiles.filter(
    (tile) => tile.feature === FEATURE.FACTORY
  ).length;

  const schoolCount = tiles.filter(
    (tile) => tile.feature === FEATURE.SCHOOL
  ).length;

  const stationCount = tiles.filter(
    (tile) => tile.feature === FEATURE.STATION
  ).length;

  const vacantRooms = mainBuildings.reduce((sum, tile) => {
    if (!tile.rooms) return sum;
    return sum + tile.rooms.filter((room) => !room.occupied).length;
  }, 0);

  let housingDemand = 50;
  let commercialDemand = 50;
  let industrialDemand = 50;

  housingDemand += Math.floor(totalPopulation / 45);
  housingDemand += schoolCount * 8;
  housingDemand += stationCount * 5;
  housingDemand += housingCount * 1;
  housingDemand -= factoryCount * 2;
  housingDemand -= Math.floor(vacantRooms / 3);

  commercialDemand += Math.floor(totalPopulation / 35);
  commercialDemand += stationCount * 8;
  commercialDemand += commercialCount * 3;
  commercialDemand += housingCount * 1;
  commercialDemand -= Math.floor(vacantRooms / 6);

  industrialDemand += factoryCount * 12;
  industrialDemand += Math.floor(totalPopulation / 80);
  industrialDemand += stationCount * 2;
  industrialDemand -= schoolCount * 2;

  return {
    housing: Math.max(30, Math.min(130, housingDemand)),
    commercial: Math.max(30, Math.min(130, commercialDemand)),
    industrial: Math.max(30, Math.min(130, industrialDemand)),
  };
}, [tiles, totalPopulation]);
  const totalRent = useMemo(() => {
    return playerMainBuildings.reduce((sum, tile) => {
      return (
        sum +
        tile.rooms.reduce((roomSum, room) => {
          return roomSum + (room.occupied ? room.rent : 0);
        }, 0)
      );
    }, 0);
  }, [playerMainBuildings]);

const totalMaintenance = useMemo(() => {
  const buildingMaintenance = playerMainBuildings.reduce((sum, tile) => {
    return sum + calculateMonthlyExpenses(tile);
  }, 0);

  const employeePayroll = employees.reduce((sum, employee) => {
    return sum + (employee.salary ?? 0);
  }, 0);

  return buildingMaintenance + employeePayroll;
}, [playerMainBuildings, employees]);

const yearlyTax = useMemo(() => {
  return tiles.reduce((sum, tile) => {
    return sum + calculateYearlyPropertyTax(tile);
  }, 0);
}, [tiles]);

  const assetValue = useMemo(() => {
    return tiles.reduce((sum, tile) => {
      if (tile.owner !== OWNER.PLAYER) return sum;

      let buildingValue = 0;

      if (tile.building && !tile.buildingMainId) {
        buildingValue = BUILDINGS[tile.building].cost * 0.7;
      }

      return sum + tile.landPrice + buildingValue;
    }, 0);
  }, [tiles]);
  const monthlyProfit = useMemo(() => {
  return totalRent - totalMaintenance;
}, [totalRent, totalMaintenance]);

const totalLoanRemaining = useMemo(() => {
  return loans.reduce((sum, loan) => sum + (loan.remaining ?? 0), 0);
}, [loans]);

const totalMonthlyLoanPayment = useMemo(() => {
  return loans.reduce((sum, loan) => sum + (loan.monthlyPayment ?? 0), 0);
}, [loans]);

const actualMonthlyProfit = useMemo(() => {
  return monthlyProfit - totalMonthlyLoanPayment;
}, [monthlyProfit, totalMonthlyLoanPayment]);

const monthlyProfitIcon = actualMonthlyProfit >= 0 ? "📈" : "📉";
const monthlyProfitSign = actualMonthlyProfit >= 0 ? "+" : "";

const totalPendingLoanAmount = useMemo(() => {
  return pendingLoanApplications.reduce((sum, application) => {
    return sum + (application.requestedAmount ?? 0);
  }, 0);
}, [pendingLoanApplications]);

const netWorthAfterDebt = useMemo(() => {
  return Math.round(money + assetValue - totalLoanRemaining);
}, [money, assetValue, totalLoanRemaining]);

const debtRatio = useMemo(() => {
  if (assetValue <= 0) return totalLoanRemaining > 0 ? 100 : 0;
  return Math.round((totalLoanRemaining / assetValue) * 100);
}, [assetValue, totalLoanRemaining]);

const loanCapacityByBank = useMemo(() => {
  const yearlyNetIncome = Math.max(0, monthlyProfit - totalMonthlyLoanPayment) * 12;

  return Object.values(BANKS).reduce((result, bank) => {
    const incomeCapacity = yearlyNetIncome * bank.approvalMultiplier;
    const collateralCapacity = assetValue * bank.collateralRate;
    const rankBonus = Math.max(0, playerRank - bank.minRank) * 1500;
    const cashBuffer = Math.max(0, money) * 0.35;
    const baseLimit = Math.max(0, Math.round(incomeCapacity + collateralCapacity + rankBonus + cashBuffer));
    const nonbankStartupLimit = bank.id === "nonbank" ? Math.max(1000, Math.min(5000, Math.round(Math.max(money * 0.5, assetValue * 0.18 + money * 0.4 + 1200)))) : 0;
    const grossLimit = bank.id === "nonbank" ? Math.max(baseLimit, nonbankStartupLimit) : baseLimit;
    const pendingAmountForBank = pendingLoanApplications.reduce((sum, application) => {
      if (application.bankId !== bank.id) return sum;
      return sum + (application.requestedAmount ?? 0);
    }, 0);
    const remainingLimit = Math.max(0, grossLimit - totalLoanRemaining - pendingAmountForBank);
    const smallRegionalStartupOk = bank.id === "regional" &&
      monthlyProfit >= 0 &&
      totalLoanRemaining <= Math.max(5000, assetValue * 0.45);
    const nonbankStartupOk = bank.id === "nonbank" &&
      totalLoanRemaining <= Math.max(7000, assetValue * 0.7);
    const dscrOk = monthlyProfit <= 0
      ? (smallRegionalStartupOk || nonbankStartupOk)
      : totalMonthlyLoanPayment <= Math.max(50, monthlyProfit * (bank.id === "nonbank" ? 1.2 : 0.75));
    const rankOk = playerRank >= bank.minRank;
    const debtLimit = bank.id === "nonbank" ? 110 : bank.id === "regional" ? 95 : 85;
    const debtOk = assetValue <= 0 ? totalLoanRemaining === 0 || bank.id === "nonbank" : debtRatio <= debtLimit;

    result[bank.id] = {
      bank,
      grossLimit,
      remainingLimit,
      dscrOk,
      rankOk,
      debtOk,
      canApply: remainingLimit > 0 && rankOk && dscrOk && debtOk,
    };

    return result;
  }, {});
}, [assetValue, debtRatio, money, monthlyProfit, pendingLoanApplications, playerRank, totalLoanRemaining, totalMonthlyLoanPayment]);

const officeTiles = useMemo(() => {
  return tiles.filter((tile) => {
    return tile.owner === OWNER.PLAYER && (tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH);
  });
}, [tiles]);

const selectedOfficeTile = useMemo(() => {
  const mainSelectedTile = getMainTile(selectedTile);

  if (!mainSelectedTile) return null;

  if (
    mainSelectedTile.owner === OWNER.PLAYER &&
    (mainSelectedTile.feature === FEATURE.HQ || mainSelectedTile.feature === FEATURE.BRANCH)
  ) {
    return mainSelectedTile;
  }

  return null;
}, [selectedTile, tiles]);

const selectedRivalOfficeTile = useMemo(() => {
  const mainSelectedTile = getMainTile(selectedTile);

  if (!mainSelectedTile) return null;

  if (
    mainSelectedTile.owner === OWNER.RIVAL &&
    (mainSelectedTile.feature === FEATURE.HQ || mainSelectedTile.feature === FEATURE.BRANCH)
  ) {
    return mainSelectedTile;
  }

  return null;
}, [selectedTile, tiles]);

function getOfficeActionRange(officeTile) {
  if (!officeTile) return 0;
  if (officeTile.feature === FEATURE.HQ) return HQ_ACTION_RANGE;
  if (officeTile.feature === FEATURE.BRANCH) {
    return officeTile.branchUnderConstruction ? 0 : BRANCH_ACTION_RANGE;
  }

  return 0;
}

function getReachableOfficeTilesForTile(tile) {
  if (!hqPlaced) return [];
  if (!tile) return [];

  return officeTiles.filter((officeTile) => {
    const range = getOfficeActionRange(officeTile);
    if (range <= 0) return false;
    return getDistance(tile.x, tile.y, officeTile.x, officeTile.y) <= range;
  });
}

function getReachableOfficeIdsForTile(tile) {
  return new Set(
    getReachableOfficeTilesForTile(tile).map((officeTile) => officeTile.officeId ?? "hq")
  );
}

function isTileInOfficeRange(tile) {
  return getReachableOfficeTilesForTile(tile).length > 0;
}

function isTileInSelectedOfficeRange(tile) {
  if (!selectedOfficeTile || !tile) return false;

  const range = getOfficeActionRange(selectedOfficeTile);

  return getDistance(tile.x, tile.y, selectedOfficeTile.x, selectedOfficeTile.y) <= range;
}

function isTileInSelectedRivalOfficeRange(tile) {
  if (!selectedRivalOfficeTile || !tile) return false;

  const range = getOfficeActionRange(selectedRivalOfficeTile);

  return getDistance(tile.x, tile.y, selectedRivalOfficeTile.x, selectedRivalOfficeTile.y) <= range;
}

function getNearestOfficeNameForTile(tile) {
  if (!tile) return null;

  const reachableOffices = officeTiles
    .filter((officeTile) => {
      const range = getOfficeActionRange(officeTile);
      return getDistance(tile.x, tile.y, officeTile.x, officeTile.y) <= range;
    })
    .sort((a, b) => {
      const distanceA = getDistance(tile.x, tile.y, a.x, a.y);
      const distanceB = getDistance(tile.x, tile.y, b.x, b.y);
      return distanceA - distanceB;
    });

  if (reachableOffices.length === 0) return null;

  return reachableOffices[0].officeName ?? reachableOffices[0].hqName ?? "本社";
}

function getBuildingAreaTiles(startTile, buildingKey) {
  const building = BUILDINGS[buildingKey];

  if (!startTile || !building) return [];

  function collectArea(width, height) {
    const areaTiles = [];

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startTile.x + dx;
        const y = startTile.y + dy;
        const areaTile = tiles.find((tile) => tile.x === x && tile.y === y);

        if (!areaTile) return [];

        areaTiles.push(areaTile);
      }
    }

    return areaTiles;
  }

  const normalArea = collectArea(building.width, building.height);

  if (normalArea.length === building.width * building.height) {
    return normalArea;
  }

  const rotatedArea = collectArea(building.height, building.width);

  if (rotatedArea.length === building.width * building.height) {
    return rotatedArea;
  }

  return [];
}

function isBuildingAreaInOfficeRange(startTile, buildingKey) {
  const areaTiles = getBuildingAreaTiles(startTile, buildingKey);

  if (areaTiles.length === 0) return false;

  return areaTiles.every((areaTile) => isTileInOfficeRange(areaTile));
}

function getResolvedBuildStartTile(clickedTile, buildingKey) {
  const building = BUILDINGS[buildingKey];

  if (!clickedTile || !building) return null;

  const sizePatterns = [
    { width: building.width, height: building.height },
  ];

  if (building.width !== building.height) {
    sizePatterns.push({ width: building.height, height: building.width });
  }

  for (const size of sizePatterns) {
    for (let offsetY = 0; offsetY < size.height; offsetY++) {
      for (let offsetX = 0; offsetX < size.width; offsetX++) {
        const startX = clickedTile.x - offsetX;
        const startY = clickedTile.y - offsetY;

        if (startX < 0 || startY < 0) continue;

        const startTile = tiles.find((tile) => tile.x === startX && tile.y === startY);

        if (!startTile) continue;

        const placement = canPlaceBuilding(startTile, buildingKey);

        if (!placement.ok) continue;
        if (placement.width !== size.width || placement.height !== size.height) continue;
        if (!isBuildingAreaInOfficeRange(startTile, buildingKey)) continue;

        const isClickedTileInArea =
          clickedTile.x >= startTile.x &&
          clickedTile.x < startTile.x + placement.width &&
          clickedTile.y >= startTile.y &&
          clickedTile.y < startTile.y + placement.height;

        if (isClickedTileInArea) {
          return startTile;
        }
      }
    }
  }

  return null;
}

function canUseAsBuildTarget(tile, buildingKey) {
  if (!tile || !buildingKey) return false;
  if (tile.owner !== OWNER.PLAYER) return false;
  if (!isBuildableTile(tile)) return false;
  if (tile.building || tile.buildingMainId) return false;
  if (!isTileInOfficeRange(tile)) return false;

  return Boolean(getResolvedBuildStartTile(tile, buildingKey));
}

function canUseAsBranchTarget(tile) {
  if (!tile) return false;
  if (officeTiles.some((officeTile) => officeTile.feature === FEATURE.BRANCH && officeTile.branchUnderConstruction)) return false;
  if (tile.owner !== OWNER.PLAYER) return false;
  if (!isBuildableTile(tile)) return false;
  if (tile.building || tile.buildingMainId) return false;
  if (!isTileInOfficeRange(tile)) return false;

  const nearestOfficeDistance = officeTiles.reduce((minDistance, officeTile) => {
    return Math.min(
      minDistance,
      getDistance(tile.x, tile.y, officeTile.x, officeTile.y)
    );
  }, 999);

  return nearestOfficeDistance >= OFFICE_MIN_DISTANCE;
}

const branchCount = useMemo(() => {
  return officeTiles.filter((tile) => tile.feature === FEATURE.BRANCH).length;
}, [officeTiles]);

const activeOfficeTiles = useMemo(() => {
  return officeTiles.filter((officeTile) => getOfficeActionRange(officeTile) > 0);
}, [officeTiles]);

const employeeLimit = useMemo(() => {
  if (!hqPlaced) return 0;

  return activeOfficeTiles.length * MAX_EMPLOYEES_PER_OFFICE;
}, [hqPlaced, activeOfficeTiles]);

const nextBranchRequiredEmployeeCount = useMemo(() => {
  return (branchCount + 1) * 5;
}, [branchCount]);

const canOpenNextBranchByEmployeeCount = useMemo(() => {
  return employees.length >= nextBranchRequiredEmployeeCount;
}, [employees, nextBranchRequiredEmployeeCount]);

const companyActionPower = useMemo(() => {
  if (!hqPlaced) return 0;

  return activeOfficeTiles.length;
}, [hqPlaced, activeOfficeTiles]);

const employeeSalaryTotal = useMemo(() => {
  return employees.reduce((sum, employee) => {
    return sum + (employee.salary ?? 0);
  }, 0);
}, [employees]);

const employeeCountText = useMemo(() => {
  return `${employees.length}/${employeeLimit}`;
}, [employees, employeeLimit]);

const ownedEmployeeCount = useMemo(() => {
  return employees.length + employeeStorage.length;
}, [employees, employeeStorage]);

function getEmployeeSortValue(employee, sortKey) {
  if (sortKey === "name") return employee.name ?? "";
  if (sortKey === "rarity") return getEmployeeRarityOrder(employee.rarity);
  if (sortKey === "level") return employee.level ?? 1;
  if (sortKey === "exp") return employee.exp ?? 0;
  if (sortKey === "leadership") return employee.leadership ?? 0;
  if (sortKey === "sales") return employee.sales ?? 0;
  if (sortKey === "construction") return employee.construction ?? 0;
  if (sortKey === "management") return employee.management ?? 0;
  if (sortKey === "salary") return employee.salary ?? 0;
  if (sortKey === "special") return getEmployeeSpecialText(employee);
  if (sortKey === "office") return getCompanyEmployeeOfficeName(employee, false);
  return 0;
}

function compareEmployeeSortValue(aValue, bValue) {
  if (typeof aValue === "string" || typeof bValue === "string") {
    return String(aValue).localeCompare(String(bValue), "ja");
  }

  return (aValue ?? 0) - (bValue ?? 0);
}

function changeEmployeeSort(sortKey) {
  if (employeeSortKey === sortKey) {
    setEmployeeSortDirection(employeeSortDirection === "desc" ? "asc" : "desc");
    return;
  }

  setEmployeeSortKey(sortKey);
  setEmployeeSortDirection(sortKey === "name" || sortKey === "office" || sortKey === "special" ? "asc" : "desc");
}

function getSortMark(sortKey) {
  if (employeeSortKey !== sortKey) return "▽";

  return employeeSortDirection === "desc" ? "▼" : "▲";
}

function renderEmployeeSortHeader(label, sortKey) {
  return (
    <button
      type="button"
      className="table-sort-button"
      onClick={() => changeEmployeeSort(sortKey)}
    >
      <span>{label}</span>
      <span>{getSortMark(sortKey)}</span>
    </button>
  );
}


function changeCompanySort(sortKey) {
  if (companySortKey === sortKey) {
    setCompanySortDirection((current) => current === "asc" ? "desc" : "asc");
    return;
  }

  setCompanySortKey(sortKey);
  setCompanySortDirection(sortKey === "name" || sortKey === "type" ? "asc" : "desc");
}

function getCompanySortMark(sortKey) {
  if (companySortKey !== sortKey) return "▽";
  return companySortDirection === "asc" ? "▲" : "▼";
}

function renderCompanySortHeader(label, sortKey) {
  return (
    <button
      type="button"
      className="table-sort-button"
      onClick={() => changeCompanySort(sortKey)}
    >
      <span>{label}</span>
      <span>{getCompanySortMark(sortKey)}</span>
    </button>
  );
}

function getCompanySortValue(row, sortKey) {
  if (sortKey === "type") return row.typeLabel ?? "";
  if (sortKey === "name") return row.companyName ?? "";
  if (sortKey === "money") return row.money ?? 0;
  if (sortKey === "rank") return row.rank ?? 0;
  if (sortKey === "rent") return row.rent ?? 0;
  if (sortKey === "maintenance") return row.maintenance ?? 0;
  if (sortKey === "profit") return row.profit ?? 0;
  if (sortKey === "ownedTiles") return row.ownedTiles ?? 0;
  if (sortKey === "offices") return row.offices ?? 0;
  if (sortKey === "buildings") return row.buildings?.length ?? 0;
  if (sortKey === "employees") return row.employeeCount ?? 0;
  if (sortKey === "asset") return (row.money ?? 0) + (row.assetValue ?? 0);
  return 0;
}

function sortCompanyRowsForDisplay(rowList) {
  return [...rowList].sort((a, b) => {
    const valueA = getCompanySortValue(a, companySortKey);
    const valueB = getCompanySortValue(b, companySortKey);

    if (typeof valueA === "string" || typeof valueB === "string") {
      const result = String(valueA).localeCompare(String(valueB), "ja");
      return companySortDirection === "asc" ? result : -result;
    }

    const result = (valueA ?? 0) - (valueB ?? 0);
    return companySortDirection === "asc" ? result : -result;
  });
}

function getCompanyEmployeeOfficeName(employee, isStored = false) {
  if (isStored || employee?.isStoredEmployee) return "社員保管庫";
  if (employee?.displayOfficeName) return employee.displayOfficeName;
  if (employee?.companyEmployeeOfficeName) return employee.companyEmployeeOfficeName;

  const officeId = employee?.officeId ?? "hq";

  if (officeId === "hq") return "本社";
  if (String(officeId).includes("_hq")) return "本社";
  if (String(officeId).includes("branch")) return "支店";

  return getOfficeName(officeId);
}

function sortEmployeesForDisplay(employeeList) {
  return [...employeeList].sort((a, b) => {
    const primaryCompare = compareEmployeeSortValue(
      getEmployeeSortValue(a, employeeSortKey),
      getEmployeeSortValue(b, employeeSortKey)
    );

    if (primaryCompare !== 0) {
      return employeeSortDirection === "desc" ? -primaryCompare : primaryCompare;
    }

    const rarityDiff = getEmployeeRarityOrder(b.rarity) - getEmployeeRarityOrder(a.rarity);

    if (rarityDiff !== 0) return rarityDiff;

    const totalA = (a.sales ?? 0) + (a.construction ?? 0) + (a.management ?? 0);
    const totalB = (b.sales ?? 0) + (b.construction ?? 0) + (b.management ?? 0);

    if (totalB !== totalA) return totalB - totalA;

    return (a.id ?? 0) - (b.id ?? 0);
  });
}

const vacancyRate = useMemo(() => {
  const rooms = playerMainBuildings.flatMap((tile) => tile.rooms || []);

  if (rooms.length === 0) return 0;

  const vacantCount = rooms.filter((room) => !room.occupied).length;

  return Math.round((vacantCount / rooms.length) * 100);
}, [playerMainBuildings]);

  function getDemand(tile, buildingKey) {
    const targetTile = getMainTile(tile);
    if (!targetTile || !buildingKey) return 0;

    const building = BUILDINGS[buildingKey];
    if (!building) return 0;

    const stationDistance = getDistance(targetTile.x, targetTile.y, 14, 10);
    const schoolDistance = getDistance(targetTile.x, targetTile.y, 8, 8);
    const factoryDistance = getDistance(targetTile.x, targetTile.y, 20, 20);

    let demand = 35;

// カテゴリ別需要
if (
  building.category === "住宅" ||
  building.category === "住宅" ||
  building.category === "住宅"
) {
  demand += Math.floor(
    (demandByCategory.housing - 50) / 2
  );
}

if (building.category === "商業") {
  demand += Math.floor(
    (demandByCategory.commercial - 50) / 2
  );
}

if (
  building.category === "工業"
) {
  demand += Math.floor(
    (demandByCategory.industrial - 50) / 2
  );
}

// 全体需要
demand += Math.floor((cityDemandIndex - 50) / 3);
    demand += Math.max(0, 45 - stationDistance * 5);

    if (
      building.category === "住宅" ||
      building.category === "住宅" ||
      building.category === "住宅"
    ) {
      demand += Math.max(0, 30 - schoolDistance * 5);
     if (building.category === "住宅") {
  if (factoryDistance <= 3) {
    demand -= 15;
  } else {
    demand += Math.max(0, 12 - factoryDistance * 2);
  }
}

if (building.category === "住宅") {
  demand += Math.max(0, 24 - factoryDistance * 4);
}

if (building.category === "住宅") {
  demand += Math.max(0, 16 - factoryDistance * 3);

  if (factoryDistance <= 2) {
    demand -= 8;
  }
}

if (building.category === "商業") {
  demand += Math.max(0, 18 - factoryDistance * 3);
}
    }

    if (building.category === "商業") {
      demand += Math.max(0, 30 - stationDistance * 5);
      demand += Math.floor(totalPopulation / 25);
    }

    const seasonBonus = getSeasonDemandBonus(gameDate.month, buildingKey);
demand += seasonBonus;

const hqDistance = getHQDistance(tile);

if (hqDistance <= 5) {
  demand *= 1.5;
}

return Math.min(95, Math.max(50, Math.round(demand)));
  }

function getRentMultiplier(tile, buildingKey) {
  const mainTile = getMainTile(tile);
  if (!mainTile || !buildingKey) return 1.0;

  const demand = getDemand(mainTile, buildingKey);
  const stationDistance = getDistance(mainTile.x, mainTile.y, 14, 10);
  const schoolDistance = getDistance(mainTile.x, mainTile.y, 8, 8);

  let multiplier = 1.0;

  multiplier += (demand - 50) / 200;

  if (stationDistance <= 3) multiplier += 0.12;
  if (schoolDistance <= 4) multiplier += 0.05;

  if (!BUILDINGS[buildingKey]) return 1.0;

  if (BUILDINGS[buildingKey].category === "商業") {
    multiplier += Math.min(0.25, totalPopulation / 500);
  }

  const conditionRate = (mainTile.condition ?? 100) / 100;

  multiplier *= 0.6 + conditionRate * 0.4;

  return Math.max(0.75, Math.min(1.6, multiplier));
}

function calculateNewRent(tile, buildingKey, tenantKey) {
  const mainTile = getMainTile(tile);
  const building = BUILDINGS[buildingKey];
  const tenant = TENANT_TYPES[tenantKey];

  if (!mainTile || !building || !tenant) return 0;

  const age = mainTile.age ?? 0;
  const condition = mainTile.condition ?? 100;

  let ageRate = 1;

  if (age > 10) {
    ageRate -= (age - 10) * 0.005;
  }

  ageRate = Math.max(0.75, ageRate);

  let conditionRate = 1;

  if (condition < 80) {
    const minRate = condition / 100;
    const maxRate = Math.min(1, (condition + 29) / 100);

    const landPower = Math.min(1, mainTile.landPrice / 10000);
    conditionRate = minRate + (maxRate - minRate) * landPower;
  }

// 需要倍率
const demandRate =
  getRentMultiplier(mainTile, buildingKey);

// 地価補正
// 地価高い土地ほど家賃上昇
const landPriceRate =
  Math.min(
    1.8,
    0.8 + mainTile.landPrice / 8000
  );

// 駅距離
const stationDistance = getDistance(
  mainTile.x,
  mainTile.y,
  stationPos.x,
  stationPos.y
);

// 駅近補正
let stationRate = 1;

if (stationDistance <= 1) {
  stationRate = 1.35;
}
else if (stationDistance <= 3) {
  stationRate = 1.2;
}
else if (stationDistance <= 5) {
  stationRate = 1.1;
}

// 最終家賃
const rent =
  building.baseRent *
  tenant.rentPower *
  ageRate *
  conditionRate *
  demandRate *
  landPriceRate *
  stationRate;

  return Math.max(3, Math.round(rent));
}

function getRentDemandPenalty(tile, buildingKey, tenantKey) {
  const building = BUILDINGS[buildingKey];
  const tenant = TENANT_TYPES[tenantKey];

  if (!building || !tenant) return 1;

  const standardRent = building.baseRent * tenant.rentPower;
  const newRent = calculateNewRent(tile, buildingKey, tenantKey);

  const rentRatio = newRent / standardRent;

  if (rentRatio <= 1.0) return 1.1;
  if (rentRatio <= 1.1) return 1.0;
  if (rentRatio <= 1.2) return 0.85;
  if (rentRatio <= 1.35) return 0.65;

  return 0.45;
}
function canPlaceBuilding(startTile, buildingKey) {
  const building = BUILDINGS[buildingKey];

  function checkArea(width, height) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startTile.x + dx;
        const y = startTile.y + dy;

        if (x >= MAP_SIZE || y >= MAP_SIZE) return false;

        const tile = tiles.find(
          (t) => t.x === x && t.y === y
        );

        if (!tile) return false;
        if (tile.owner !== OWNER.PLAYER) return false;
        if (!isBuildableTile(tile)) return false;
        if (tile.building) return false;
        if (tile.buildingMainId) return false;
      }
    }

    return true;
  }

  // 通常向き
  if (checkArea(building.width, building.height)) {
    return {
      ok: true,
      width: building.width,
      height: building.height,
    };
  }

  // 回転向き
  if (checkArea(building.height, building.width)) {
    return {
      ok: true,
      width: building.height,
      height: building.width,
    };
  }

  return {
    ok: false,
  };
}
function canPlaceFactoryProject3x3(centerTile, tileList) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerTile.x + dx;
      const y = centerTile.y + dy;

      const tile = tileList.find(
        (t) => t.x === x && t.y === y
      );

      if (!tile) return false;
      if (tile.terrain !== TERRAIN.PLAIN) return false;
      if (tile.feature !== FEATURE.NONE) return false;
      if (tile.building) return false;
      if (tile.buildingMainId) return false;
      if (tile.owner === OWNER.PLAYER) return false;
      if (tile.owner === OWNER.PUBLIC) return false;
    }
  }

  return true;
}
function canPlaceNPCBuilding(startTile, buildingKey, tileList) {
  const building = BUILDINGS[buildingKey];

  function checkArea(width, height) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startTile.x + dx;
        const y = startTile.y + dy;

        if (x >= MAP_SIZE || y >= MAP_SIZE) {
          return false;
        }

        const tile = tileList.find(
          (t) => t.x === x && t.y === y
        );

        if (!tile) return false;

        if (tile.owner !== OWNER.OTHER) {
          return false;
        }

        if (!isBuildableTile(tile)) {
          return false;
        }

        if (tile.building) {
          return false;
        }

        if (tile.buildingMainId) {
          return false;
        }
      }
    }

    return true;
  }

  // 通常向き
  if (checkArea(building.width, building.height)) {
    return {
      ok: true,
      width: building.width,
      height: building.height,
    };
  }

  // 回転向き
  if (checkArea(building.height, building.width)) {
    return {
      ok: true,
      width: building.height,
      height: building.width,
    };
  }

  return {
    ok: false,
  };
}

function canPlaceCompanyBuilding(startTile, buildingKey, tileList, owner, companyId) {
  const building = BUILDINGS[buildingKey];
  if (!building || !startTile) {
    return { ok: false };
  }

  function checkArea(width, height) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startTile.x + dx;
        const y = startTile.y + dy;

        if (x >= MAP_SIZE || y >= MAP_SIZE) return false;

        const tile = tileList.find((t) => t.x === x && t.y === y);
        if (!tile) return false;
        if (tile.owner !== owner) return false;
        if (owner === OWNER.RIVAL && tile.rivalCompanyId !== companyId) return false;
        if (!isBuildableTile(tile)) return false;
        if (tile.building || tile.buildingMainId) return false;
      }
    }

    return true;
  }

  if (checkArea(building.width, building.height)) {
    return { ok: true, width: building.width, height: building.height };
  }

  if (checkArea(building.height, building.width)) {
    return { ok: true, width: building.height, height: building.width };
  }

  return { ok: false };
}

function canPlaceNPCRebuild(startTile, buildingKey, tileList) {
  const building = BUILDINGS[buildingKey];

  function checkArea(width, height) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const x = startTile.x + dx;
        const y = startTile.y + dy;

        if (x >= MAP_SIZE || y >= MAP_SIZE) {
          return false;
        }

        const tile = tileList.find(
          (t) => t.x === x && t.y === y
        );

        if (!tile) {
          return false;
        }

        if (tile.owner !== OWNER.OTHER) {
          return false;
        }

        if (!isBuildableTile(tile)) {
          return false;
        }

        if (
          tile.building &&
          tile.id !== startTile.id &&
          tile.buildingMainId !== startTile.id
        ) {
          return false;
        }

        if (
          tile.buildingMainId &&
          tile.buildingMainId !== startTile.id
        ) {
          return false;
        }
      }
    }

    return true;
  }

  if (checkArea(building.width, building.height)) {
    return {
      ok: true,
      width: building.width,
      height: building.height,
    };
  }

  if (checkArea(building.height, building.width)) {
    return {
      ok: true,
      width: building.height,
      height: building.width,
    };
  }

  return {
    ok: false,
  };
}
function selectBuildingFromList(tileId) {
    setSelectedId(tileId);

    setTimeout(() => {
      detailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }
function getOfficeName(officeId) {
  if (officeId === "hq") return "本社";

  const officeTile = officeTiles.find((tile) => {
    return (tile.officeId ?? "hq") === officeId;
  });

  return officeTile?.officeName ?? officeTile?.hqName ?? "不明";
}

function getBranchDisplayName(tile) {
  if (!tile || tile.feature !== FEATURE.BRANCH) return "支店";

  if (tile.branchNumber) {
    return `支${tile.branchNumber}`;
  }

  const officeName = tile.officeName ?? "";
  const numberMatch = officeName.match(/支店(\d+)/);
  if (numberMatch) {
    return `支${numberMatch[1]}`;
  }

  return "支店";
}

function getFirstAvailableOffice() {
  return activeOfficeTiles.find((officeTile) => {
    const officeId = officeTile.officeId ?? "hq";
    const currentCount = employees.filter((employee) => {
      return (employee.officeId ?? "hq") === officeId;
    }).length;

    return currentCount < MAX_EMPLOYEES_PER_OFFICE;
  });
}

function getEmployeeRarityOrder(rarity) {
  if (rarity === "UR") return 6;
  if (rarity === "SSR") return 5;
  if (rarity === "SR") return 4;
  if (rarity === "HR") return 3;
  if (rarity === "R") return 2;
  return 1;
}

function drawRecruitRarity() {
  const roll = Math.random() * 100;

  if (roll < 61.7) return "N";
  if (roll < 83.7) return "R";
  if (roll < 93.7) return "HR";
  if (roll < 98.7) return "SR";
  if (roll < 99.7) return "SSR";
  return "UR";
}

function drawPremiumRecruitRarity() {
  const roll = Math.random() * 100;

  if (roll < 79.4) return "SR";
  if (roll < 95.3) return "SSR";
  return "UR";
}

function pickRecruitEmployee(availableEmployees, pickedEmployees, premiumOnly = false) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const rarity = premiumOnly ? drawPremiumRecruitRarity() : drawRecruitRarity();
    const sameRarityEmployees = availableEmployees.filter((employee) => {
      return employee.rarity === rarity;
    });

    if (sameRarityEmployees.length > 0) {
      return sameRarityEmployees[randomInt(0, sameRarityEmployees.length - 1)];
    }
  }

  const fallbackEmployees = availableEmployees.filter((employee) => {
    if (premiumOnly) return ["SR", "SSR", "UR"].includes(employee.rarity);
    return true;
  });

  if (fallbackEmployees.length === 0) return null;

  fallbackEmployees.sort((a, b) => {
    return getEmployeeRarityOrder(a.rarity) - getEmployeeRarityOrder(b.rarity);
  });

  return fallbackEmployees[randomInt(0, fallbackEmployees.length - 1)];
}


function getEmployeeSpecialText(employee) {
  if (Array.isArray(employee.specialNames) && employee.specialNames.length > 0) {
    return employee.specialNames.join(" / ");
  }

  if (employee.special && employee.special !== "なし") {
    return employee.special;
  }

  return "なし";
}

function getSpecialSkillDescription(skillName) {
  const descriptions = {
    "なし": "特殊能力なし",
    "交渉人": "土地購入・売却交渉で有利に働く。",
    "市場分析": "地価や需要を読む力が高く、営業判断を安定させる。",
    "数字に強い": "収支判断・管理業務でミスを減らす。",
    "法務感覚": "契約・売買・トラブル対応でリスクを下げる。",
    "管理の鬼": "入居管理・維持管理で効果を発揮する。",
    "鉄壁管理": "管理面の安定性が高く、空室・滞納リスクを抑える。",
    "入居者目線": "入居率や満足度に良い影響を与える。",
    "クレーム処理": "退去・苦情・トラブルの悪影響を抑える。",
    "空室キラー": "空室改善や客付けで効果を発揮する。",
    "満室請負人": "入居率上昇に大きく貢献する。",
    "満室神話": "専用級能力。入居率・需要面で強い補正を持つ。",
    "家賃査定士": "適正家賃の判断に優れ、収益安定に貢献する。",
    "家主目線": "長期保有・収支管理に強い。",
    "原価管理": "建築費・修繕費の抑制に役立つ。",
    "費用圧縮": "維持費・工事費を抑える方向に働く。",
    "名工": "建築品質・工期短縮に強い。",
    "現場監督": "建築現場の進行を安定させる。",
    "現場主義": "建築・修繕系の仕事で力を発揮する。",
    "職人気質": "建築品質が高いが、営業や調整は苦手な場合がある。",
    "図面読み": "建築・大型案件の計画で効果を発揮する。",
    "DIY達人": "小規模修繕や物件再生で有利。",
    "修繕眼": "劣化や修繕判断に強い。",
    "物件再生": "古い建物や低状態物件の改善に強い。",
    "再生の魔術師": "専用級能力。物件再生で大きな補正を持つ。",
    "段取り上手": "工期遅延を抑え、作業進行を安定させる。",
    "スピード対応": "短期案件や緊急対応で有利。",
    "即断即決": "意思決定が早く、行動の遅れを抑える。",
    "先読み": "イベントやリスクの先読みで安定性を上げる。",
    "慎重派": "失敗リスクを下げるが、速度はやや落ちることがある。",
    "冷静沈着": "トラブル時の悪影響を抑える。",
    "火消し役": "問題発生時の損失を軽減する。",
    "調整役": "複数人作業や支店運営を安定させる。",
    "チーム統率": "同じ事務所のチーム作業に良い影響を与える。",
    "軍師": "統率・判断面に優れ、チーム全体を底上げする。",
    "カリスマ": "同じ事務所の社員に良い影響を与える。",
    "若手育成": "社員経験値・成長系に良い影響を与える。",
    "成長株": "経験値獲得や成長に期待できる。",
    "努力家": "経験値獲得や長期育成で有利。",
    "集中力": "担当作業の安定性を高める。",
    "一点突破": "得意分野で大きな力を発揮する。",
    "粘り腰": "難航案件で成功率を支える。",
    "人脈豊富": "営業・採用・紹介系イベントで有利。",
    "黄金の人脈": "専用級能力。人脈を使う案件で非常に強い。",
    "法人営業": "商業・法人契約・大型案件で有利。",
    "広告上手": "入居募集や商業需要に良い影響を与える。",
    "情報通": "売り物件やチャンス発見に役立つ。",
    "地域密着": "周辺エリアの営業・入居付けに強い。",
    "資金繰り": "資金管理・借入・大型投資判断で有利。",
    "金融感覚": "借入や投資判断で強い。",
    "堅実運用": "収支安定・リスク低減に貢献する。",
    "改善提案": "管理・修繕・収益改善で効果を発揮する。",
    "聞き上手": "入居者対応や交渉で有利。",
    "客付け名人": "入居付けに強い。",
    "地元の顔役": "地域での営業・交渉に強い。",
    "王者の査定眼": "専用級能力。売買価格判断で非常に強い。",
    "絶対交渉権": "専用級能力。土地購入・売却交渉で非常に強い。",
    "利益の錬金術師": "専用級能力。収益改善・費用圧縮に非常に強い。",
    "都市開発の覇者": "専用級能力。広域開発・大型案件で非常に強い。",
    "超能力者": "専用級能力。月ごとにランダムな好影響が出る可能性がある。",
    "未来予知": "将来イベントや地価変動の判断に強い。",
    "不動産王": "売買・建築・管理を総合的に底上げする。",
    "創業者魂": "会社全体の成長や長期経営に良い影響を与える。",
    "飽き性": "長期案件で集中力が落ちやすい。",
    "現場嫌い": "建築・修繕系でマイナスになりやすい。",
    "慎重すぎる": "失敗は減るが、行動が遅れやすい。",
    "遅刻癖": "行動開始や工期に悪影響を与えることがある。",
    "見栄っ張り": "費用増加や判断ミスにつながる場合がある。",
    "報連相不足": "チーム作業や支店運営でマイナスになりやすい。",
    "抱え込み": "複数人作業で効率が落ちることがある。",
    "設備音痴": "設備・修繕系でマイナスになりやすい。",
    "朝が弱い": "作業開始や短期案件で不安定になる。",
    "交渉下手": "購入・売却交渉で不利になりやすい。",
    "数字が苦手": "収支判断・管理業務でミスが出やすい。",
    "整理下手": "事務処理や管理業務で効率が下がる。",
    "空回り": "能力はあるが成果が安定しにくい。",
    "短気": "交渉・入居者対応でトラブルを起こしやすい。",
    "押しが弱い": "営業・交渉で成果が伸びにくい。",
    "詰めが甘い": "完了直前のミスや追加費用につながることがある。",
    "気分屋": "月によって成果がばらつく。",
    "弱気": "営業や交渉で本来の力を出しにくい。",
    "浪費家": "維持費・経費が増えやすい。",
    "書類ミス": "契約・管理でミスが起こりやすい。"
  };

  return descriptions[skillName] ?? "効果未設定。今後の特殊能力実装で効果を設定予定。";
}

function renderEmployeeNameButton(employee) {
  return (
    <button
      type="button"
      className="employee-name-button"
      onClick={() => setSelectedEmployeeDetail(employee)}
    >
      {employee.name}
    </button>
  );
}

function moveEmployee(employeeId, officeId) {
  const targetCount = employees.filter((employee) => {
    return (employee.officeId ?? "hq") === officeId && employee.id !== employeeId;
  }).length;

  if (targetCount >= MAX_EMPLOYEES_PER_OFFICE) {
    alert("異動先の社員枠が満員です");
    return;
  }

  setEmployees(
    employees.map((employee) => {
      if (employee.id !== employeeId) return employee;

      return {
        ...employee,
        officeId,
      };
    })
  );

  setLog("社員を異動しました。");
}



const EMPLOYEE_GROWTH_LIMIT_BY_RARITY = {
  N: 20,
  R: 25,
  HR: 30,
  SR: 50,
  SSR: 60,
  UR: 70,
};

function getEmployeeRequiredExp(level) {
  const currentLevel = Math.max(1, level ?? 1);
  return Math.round(100 * Math.pow(1.1, currentLevel - 1));
}

function getPlayerRequiredExp(rank) {
  return getEmployeeRequiredExp(rank);
}

function applyPlayerRankExp(currentRank, currentExp, gainedExp) {
  let nextRank = Math.max(1, currentRank ?? 1);
  let nextExp = (currentExp ?? 0) + Math.max(0, gainedExp ?? 0);
  let rankUpCount = 0;

  while (nextExp >= getPlayerRequiredExp(nextRank)) {
    nextExp -= getPlayerRequiredExp(nextRank);
    nextRank += 1;
    rankUpCount += 1;
  }

  return {
    rank: nextRank,
    exp: nextExp,
    rankUpCount,
  };
}

function normalizeEmployeeGrowthBase(employee) {
  return {
    ...employee,
    level: employee.level ?? 1,
    exp: employee.exp ?? 0,
    awakening: Math.max(0, Math.min(EMPLOYEE_AWAKENING_MAX, Math.round(employee.awakening ?? 0))),
    baseLeadership: employee.baseLeadership ?? employee.leadership ?? 0,
    baseSales: employee.baseSales ?? employee.sales ?? 0,
    baseConstruction: employee.baseConstruction ?? employee.construction ?? 0,
    baseManagement: employee.baseManagement ?? employee.management ?? 0,
    baseSalary: employee.baseSalary ?? employee.salary ?? 0,
  };
}

function getEmployeeGrowthLimit(employee) {
  return EMPLOYEE_GROWTH_LIMIT_BY_RARITY[employee.rarity] ?? 20;
}


function getPlayerRankUnlocks(rank) {
  const unlocks = [];

  if (rank === 2) unlocks.push("3階建て戸建てが建築可能");
  if (rank === 3) unlocks.push("コンビニ・飲食店が建築可能");
  if (rank === 4) unlocks.push("町工場が建築可能 / 建物売却が可能");
  if (rank === 5) unlocks.push("アパート全般が建築可能");
  if (rank === 6) unlocks.push("ドラッグストア・スーパー・倉庫が建築可能");
  if (rank === 7) unlocks.push("マンション全般が建築可能");
  if (rank === 8) unlocks.push("全建物が解放");

  return unlocks;
}

function getPlayerRankUnlockSummary(fromRank, toRank) {
  const messages = [];

  for (let rank = fromRank + 1; rank <= toRank; rank++) {
    const unlocks = getPlayerRankUnlocks(rank);
    if (unlocks.length > 0) {
      messages.push(`Rank${rank}: ${unlocks.join(" / ")}`);
    }
  }

  return messages;
}

function getTicketOddsText(ticketType) {
  if (ticketType === "premium") {
    return "SR 79.4% / SSR 15.9% / UR 4.7%";
  }

  return "N 61.7% / R 22.0% / HR 10.0% / SR 5.0% / SSR 1.0% / UR 0.3%";
}


function getRequiredRankForBuilding(buildingKey) {
  if (["house_1f", "house_2f"].includes(buildingKey)) return 1;
  if (buildingKey === "house_3f") return 2;
  if (["convenience", "restaurant", "hq_apartment"].includes(buildingKey)) return 3;
  if (buildingKey === "small_factory") return 4;
  if (["apt_2f_single", "apt_2f_family", "apt_3f_single"].includes(buildingKey)) return 5;
  if (["drugstore", "supermarket", "warehouse"].includes(buildingKey)) return 6;
  if (["mansion_5f", "mansion_7f"].includes(buildingKey)) return 7;
  return 8;
}

function isBuildingUnlockedForRank(buildingKey, rank) {
  return Math.max(1, rank ?? 1) >= getRequiredRankForBuilding(buildingKey);
}

function normalizeCommandText(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function renderEmployeeStatValue(employee, statKey, baseKey) {
  const currentValue = employee?.[statKey] ?? 0;
  const baseValue = employee?.[baseKey] ?? currentValue;
  const diff = currentValue - baseValue;

  if (diff > 0) {
    return `${currentValue}（+${diff}）`;
  }

  if (diff < 0) {
    return `${currentValue}（${diff}）`;
  }

  return `${currentValue}`;
}

function renderEmployeeSalaryValue(employee) {
  const currentSalary = employee?.salary ?? 0;
  const baseSalary = employee?.baseSalary ?? currentSalary;
  const diff = currentSalary - baseSalary;

  if (diff > 0) {
    return `${currentSalary}万円（+${diff}万円）`;
  }

  if (diff < 0) {
    return `${currentSalary}万円（${diff}万円）`;
  }

  return `${currentSalary}万円`;
}

function applyEmployeeLevelUps(employee, gainedExp) {
  let updatedEmployee = normalizeEmployeeGrowthBase(employee);
  let exp = (updatedEmployee.exp ?? 0) + gainedExp;
  let level = updatedEmployee.level ?? 1;
  const levelUpMessages = [];

  while (exp >= getEmployeeRequiredExp(level)) {
    exp -= getEmployeeRequiredExp(level);
    level += 1;

    const growthCount = Math.random() < 0.3 ? 2 : 1;
    const growthMessages = [];

    for (let i = 0; i < growthCount; i++) {
      const statKeys = [
        { key: "leadership", baseKey: "baseLeadership", label: "統率" },
        { key: "sales", baseKey: "baseSales", label: "営業" },
        { key: "construction", baseKey: "baseConstruction", label: "建築" },
        { key: "management", baseKey: "baseManagement", label: "管理" },
      ];

      const growthLimit = getEmployeeGrowthLimit(updatedEmployee);
      const growableStats = statKeys.filter((stat) => {
        const baseValue = updatedEmployee[stat.baseKey] ?? updatedEmployee[stat.key] ?? 0;
        const currentValue = updatedEmployee[stat.key] ?? 0;
        return currentValue - baseValue < growthLimit;
      });

      if (growableStats.length === 0) break;

      const targetStat = growableStats[randomInt(0, growableStats.length - 1)];
      updatedEmployee = {
        ...updatedEmployee,
        [targetStat.key]: (updatedEmployee[targetStat.key] ?? 0) + 1,
      };
      growthMessages.push(`${targetStat.label}+1`);
    }

    const previousSalary = updatedEmployee.salary ?? 0;
    const nextSalary = Math.max(1, Math.round(previousSalary * 1.2));
    updatedEmployee = {
      ...updatedEmployee,
      salary: nextSalary,
    };

    const salaryMessage = `月給${previousSalary}万円→${nextSalary}万円（+${nextSalary - previousSalary}万円）`;
    levelUpMessages.push(`Lv${level} ${growthMessages.join(" / ")} / ${salaryMessage}`);
  }

  return {
    employee: {
      ...updatedEmployee,
      level,
      exp,
    },
    levelUpMessages,
  };
}

const EMPLOYEE_EXP_MULTIPLIER = 3;

function calculateLandActionExp(price) {
  if (!price || price <= 0) return 5 * EMPLOYEE_EXP_MULTIPLIER;
  return Math.max(5, Math.round(10 * Math.sqrt(price / 1000))) * EMPLOYEE_EXP_MULTIPLIER;
}

function calculateMoneyActionExp(price) {
  if (!price || price <= 0) return 5 * EMPLOYEE_EXP_MULTIPLIER;
  return Math.max(5, Math.round(8 * Math.sqrt(price / 1000))) * EMPLOYEE_EXP_MULTIPLIER;
}

function calculateMonthActionExp(months) {
  return Math.max(5, (months || 1) * 10) * EMPLOYEE_EXP_MULTIPLIER;
}

function getEmployeeStatAverage(actionEmployees, statKey) {
  if (!Array.isArray(actionEmployees) || actionEmployees.length === 0) return 50;

  const total = actionEmployees.reduce((sum, employee) => {
    return sum + (employee?.[statKey] ?? 50);
  }, 0);

  return total / actionEmployees.length;
}

/*
  【重要：社員参加アクション共通ルール】
  通常建物の建設・支店建設・修繕など、社員が参加する工事系アクションは、
  原則としてこの共通計算を必ず使う。

  ・参加社員の人数と指定ステータスを合算評価して、工期と費用を変動させる。
  ・経験値は案件ごとの総経験値を参加社員数で割って配分する。
  ・新しい建物や工事メニューを追加する場合も、個別の固定計算を作らず、
    estimateActionMonths / calculateActionCost / grantEmployeesExp を使うこと。
  ・支店だけ、修繕だけ、追加建物だけが別計算にならないようにする。
*/
function getTeamEfficiency(actionEmployees, statKey) {
  const members = Array.isArray(actionEmployees) ? actionEmployees : [];
  const count = Math.max(1, members.length);
  const averageStat = getEmployeeStatAverage(members, statKey);

  const statBonus = (averageStat - 50) * 0.006;
  const memberBonus = (count - 1) * 0.1;

  return Math.max(0.6, Math.min(1.8, 1 + statBonus + memberBonus));
}

function estimateActionMonths(baseMonths, actionEmployees, statKey) {
  const standardMonths = Math.max(1, baseMonths ?? 1);
  const efficiency = getTeamEfficiency(actionEmployees, statKey);
  let estimatedMonths = Math.max(1, Math.round(standardMonths / efficiency));

  const averageStat = getEmployeeStatAverage(actionEmployees, statKey);
  if (averageStat < 35 && actionEmployees.length <= 1) {
    estimatedMonths += 1;
  }

  return estimatedMonths;
}

function calculateActionCost(baseCost, actionEmployees, statKey) {
  const standardCost = Math.max(0, baseCost ?? 0);
  const averageStat = getEmployeeStatAverage(actionEmployees, statKey);
  const count = Math.max(1, actionEmployees.length);

  const statRate = (averageStat - 50) * 0.001;
  const teamRate = (count - 1) * 0.008;
  const randomRate = (Math.random() - 0.5) * 0.08;
  const costRate = Math.max(0.8, Math.min(1.25, 1 - statRate - teamRate + randomRate));

  return Math.max(1, Math.round(standardCost * costRate));
}

function formatActionEstimate(baseMonths, estimatedMonths) {
  if (!baseMonths || !estimatedMonths) return "";
  if (baseMonths === estimatedMonths) return `予定工期:${estimatedMonths}ヶ月`;
  return `予定工期:${baseMonths}ヶ月 → 約${estimatedMonths}ヶ月`;
}
function getRarityLabel(rarity) {
  if (rarity === "N") return "N";
  if (rarity === "R") return "R";
  if (rarity === "HR") return "HR";
  if (rarity === "SR") return "SR";
  if (rarity === "SSR") return "SSR";
  if (rarity === "UR") return "UR";
  if (rarity === "社長") return "社長";

  return rarity;
}

function getEmployeeRarityStars(rarity) {
  if (rarity === "N") return 1;
  if (rarity === "R") return 2;
  if (rarity === "HR") return 3;
  if (rarity === "SR") return 4;
  if (["SSR", "UR", "社長"].includes(rarity)) return 5;

  return 1;
}

function renderEmployeeRarityStars(rarity) {
  const starCount = getEmployeeRarityStars(rarity);

  return Array.from({ length: 5 }).map((_, index) => (
    <span key={index} className={index < starCount ? "employee-star filled" : "employee-star empty"}>★</span>
  ));
}

function getAvailableActionEmployees(options = {}) {
  const reachableOfficeIds = options.targetTile
    ? getReachableOfficeIdsForTile(options.targetTile)
    : null;

  return employees.filter((employee) => {
    if (employee.id === 0) return false;
    if (employee.busyUntilMonth && employee.busyUntilMonth > month) return false;

    if (reachableOfficeIds) {
      return reachableOfficeIds.has(employee.officeId ?? "hq");
    }

    return true;
  });
}

function getBusyEmployeeText(employee) {
  if (!employee.busyUntilMonth || employee.busyUntilMonth <= month) return "行動可能";
  const remain = Math.max(1, employee.busyUntilMonth - month);
  return `${employee.busyActionName ?? "行動中"} 残り${remain}ヶ月`;
}

function chooseActionEmployees(actionName, options = {}) {
  const availableEmployees = getAvailableActionEmployees(options);
  const maxCount = options.maxCount ?? 4;

  if (availableEmployees.length === 0) {
    const rangeText = options.targetTile
      ? "この土地を担当できる本社・支店所属の"
      : "配属中の";
    alert(`${actionName}には${rangeText}行動可能な社員が必要です。社員を本社・支店へ配属し、行動中でない社員を選んでください。`);
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const initialIds = availableEmployees.length > 0 ? [availableEmployees[0].id] : [];
    setActionEmployeeSelectionIds(initialIds);
    setActionEmployeeRequest({
      actionName,
      employees: availableEmployees,
      maxCount,
      baseMonths: options.baseMonths ?? null,
      statKey: options.statKey ?? null,
      resolve,
    });
  });
}

function chooseActionEmployee(actionName, options = {}) {
  return chooseActionEmployees(actionName, { ...options, maxCount: 1 }).then((selectedEmployees) => {
    return selectedEmployees[0] ?? null;
  });
}

function markEmployeesBusy(employeeIds, months, actionName) {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) return;
  const busyMonths = Math.max(1, months ?? 1);
  const busyUntilMonth = month + busyMonths;
  const currentEmployees = employeesRef.current.length > 0 ? employeesRef.current : employees;
  const nextEmployees = currentEmployees.map((employee) => {
    if (!employeeIds.includes(employee.id)) return employee;
    return {
      ...employee,
      busyUntilMonth,
      busyActionName: actionName,
    };
  });

  employeesRef.current = nextEmployees;
  setEmployees(nextEmployees);
}

function grantEmployeesExp(employeeIds, gainedExp, reason) {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0 || !gainedExp) return;

  const uniqueEmployeeIds = [...new Set(employeeIds)];
  const ids = new Set(uniqueEmployeeIds);
  const eachExp = Math.max(1, Math.round(gainedExp / uniqueEmployeeIds.length));
  const totalPlayerGainedExp = eachExp * uniqueEmployeeIds.length;
  const levelUpResults = [];
  const resultMessages = [];

  const currentEmployees = employeesRef.current.length > 0 ? employeesRef.current : employees;
  const nextEmployees = currentEmployees.map((employee) => {
    if (!ids.has(employee.id)) return employee;

    const beforeLevel = employee.level ?? 1;
    const beforeSalary = employee.salary ?? 0;
    const beforeStats = {
      leadership: employee.leadership ?? 0,
      sales: employee.sales ?? 0,
      construction: employee.construction ?? 0,
      management: employee.management ?? 0,
    };

    const result = applyEmployeeLevelUps(employee, eachExp);
    const after = result.employee;

    resultMessages.push(`${employee.name}が${reason}で経験値${eachExp}を獲得しました。`);

    if ((after.level ?? 1) > beforeLevel) {
      const statMessages = [];
      const statLabels = [
        ["leadership", "統率"],
        ["sales", "営業"],
        ["construction", "建築"],
        ["management", "管理"],
      ];

      statLabels.forEach(([key, label]) => {
        const diff = (after[key] ?? 0) - (beforeStats[key] ?? 0);
        if (diff !== 0) statMessages.push(`${label}+${diff}`);
      });

      const salaryDiff = (after.salary ?? 0) - beforeSalary;
      const nextRequiredExp = getEmployeeRequiredExp(after.level ?? 1);
      const levelUpText = `${employee.name}がLv${beforeLevel}→Lv${after.level}になりました。${statMessages.join(" / ") || "能力上昇なし"} / 月給+${salaryDiff}万円 / 現在EXP ${after.exp}/${nextRequiredExp}`;
      resultMessages.push(levelUpText);
      levelUpResults.push({
        ...after,
        beforeLevel,
        beforeSalary,
        beforeStats,
        statMessages,
        salaryDiff,
        levelUpText,
      });
    }

    return after;
  });

  employeesRef.current = nextEmployees;
  setEmployees(nextEmployees);

  if (totalPlayerGainedExp > 0) {
    const beforePlayerRank = playerRankRef.current;
    const beforePlayerExp = playerExpRef.current;
    const playerResult = applyPlayerRankExp(beforePlayerRank, beforePlayerExp, totalPlayerGainedExp);

    playerRankRef.current = playerResult.rank;
    playerExpRef.current = playerResult.exp;
    setPlayerRank(playerResult.rank);
    setPlayerExp(playerResult.exp);

    resultMessages.push(`プレイヤーEXP +${totalPlayerGainedExp} / 現在EXP ${playerResult.exp}/${getPlayerRequiredExp(playerResult.rank)}`);

    if (playerResult.rankUpCount > 0) {
      const unlockMessages = getPlayerRankUnlockSummary(beforePlayerRank, playerResult.rank);
      setEmployeeTickets((current) => current + playerResult.rankUpCount);
      setPlayerRankUpResult({
        beforeRank: beforePlayerRank,
        rank: playerResult.rank,
        ticketCount: playerResult.rankUpCount,
        unlockMessages,
      });
      resultMessages.push(`プレイヤーランクが${beforePlayerRank}→${playerResult.rank}に上がりました。社員チケット+${playerResult.rankUpCount}枚。${unlockMessages.join(" / ")}`);
    }
  }

  if (resultMessages.length > 0) {
    setLog(resultMessages.join("\n"));
  }

  if (levelUpResults.length > 0) {
    setEmployeeLevelUpResult(levelUpResults[0]);
  }
}

function grantEmployeeExp(employeeId, gainedExp, reason) {
  grantEmployeesExp([employeeId], gainedExp, reason);
}

function recruitEmployees() {
  startEmployeeRecruitmentByTicket("normal");
}

function recruitPremiumEmployees() {
  startEmployeeRecruitmentByTicket("premium");
}

function getRecruitEnvelopeType(rarity) {
  if (["SSR", "UR"].includes(rarity)) return "black";
  if (rarity === "SR") return "brown";
  return "white";
}

function getRecruitEnvelopeLabel(envelopeType) {
  if (envelopeType === "black") return "黒封筒";
  if (envelopeType === "brown") return "茶封筒";
  return "白封筒";
}

function createRecruitmentApplicants(ticketType) {
  const isPremium = ticketType === "premium";
  const availableEmployees = EMPLOYEE_POOL.filter((employee) => {
    if (isPremium) return ["SR", "SSR", "UR"].includes(employee.rarity);
    return true;
  });

  const pickedEmployees = [];

  for (let i = 0; i < EMPLOYEE_RECRUITMENT_ENVELOPE_COUNT; i++) {
    const pickedEmployee = pickRecruitEmployee(availableEmployees, pickedEmployees, isPremium);
    if (pickedEmployee) {
      pickedEmployees.push(pickedEmployee);
    }
  }

  return pickedEmployees.map((employee, index) => {
    const normalizedEmployee = normalizeEmployeeGrowthBase({
      ...employee,
      officeId: null,
    });
    const envelopeType = getRecruitEnvelopeType(normalizedEmployee.rarity);

    return {
      ...normalizedEmployee,
      envelopeId: `${ticketType}-${Date.now()}-${index}-${normalizedEmployee.id}`,
      envelopeType,
      opened: false,
    };
  });
}

function startEmployeeRecruitmentByTicket(ticketType) {
  if (!hqPlaced) {
    alert("先に本社を設置してください");
    return;
  }

  const isPremium = ticketType === "premium";

  if (!isPremium && employeeTickets < 1) {
    alert("社員チケットがありません。社員募集には社員チケット1枚が必要です。");
    return;
  }

  if (isPremium && premiumEmployeeTickets < 1) {
    alert("社員プレミアムチケットがありません。SR以上確定の社員募集にはプレミアムチケット1枚が必要です。");
    return;
  }

  const applicants = createRecruitmentApplicants(ticketType);

  if (applicants.length === 0) {
    alert("応募者を生成できませんでした");
    return;
  }

  if (isPremium) {
    setPremiumEmployeeTickets(premiumEmployeeTickets - 1);
  } else {
    setEmployeeTickets(employeeTickets - 1);
  }

  setEmployeeCandidates([]);
  setEmployeeGachaResult(null);
  setEmployeeRecruitmentOffer({
    ticketType,
    applicants,
    selectedEnvelopeId: null,
  });

  setLog(`${isPremium ? "社員プレミアムチケット" : "社員チケット"}1枚を使い、履歴書が${applicants.length}枚届きました。封筒を開封して1人を採用してください。`);
}

function openRecruitEnvelope(envelopeId) {
  setEmployeeRecruitmentOffer((currentOffer) => {
    if (!currentOffer) return currentOffer;

    return {
      ...currentOffer,
      selectedEnvelopeId: envelopeId,
      applicants: currentOffer.applicants.map((applicant) => {
        if (applicant.envelopeId !== envelopeId) return applicant;
        return {
          ...applicant,
          opened: true,
        };
      }),
    };
  });
}

function cancelEmployeeRecruitmentOffer() {
  const ok = window.confirm(
    "今回届いた履歴書を閉じますか？\n\n社員チケットは使用済みのため戻りません。"
  );

  if (!ok) return;

  setEmployeeRecruitmentOffer(null);
  setLog("社員募集を終了しました。今回は採用を見送りました。");
}

function findOwnedEmployeeById(employeeId) {
  const assignedEmployee = employees.find((employee) => employee.id === employeeId);
  if (assignedEmployee) return { employee: assignedEmployee, location: "assigned" };

  const storedEmployee = employeeStorage.find((employee) => employee.id === employeeId);
  if (storedEmployee) return { employee: storedEmployee, location: "storage" };

  return null;
}

function awakenEmployee(employee) {
  const normalizedEmployee = normalizeEmployeeGrowthBase(employee);
  const currentAwakening = Math.max(0, Math.round(normalizedEmployee.awakening ?? 0));

  if (currentAwakening >= EMPLOYEE_AWAKENING_MAX) {
    const levelUpResult = applyEmployeeLevelUps(normalizedEmployee, 500);
    return {
      employee: levelUpResult.employee,
      wasMaxAwakening: true,
      statMessages: ["覚醒上限のため研修EXP+500"],
      beforeAwakening: currentAwakening,
      afterAwakening: currentAwakening,
    };
  }

  const statKeys = [
    { key: "leadership", label: "統率" },
    { key: "sales", label: "営業" },
    { key: "construction", label: "建築" },
    { key: "management", label: "管理" },
  ];
  const statMessages = [];
  let updatedEmployee = {
    ...normalizedEmployee,
    awakening: currentAwakening + 1,
  };

  statKeys.forEach((stat) => {
    const currentValue = updatedEmployee[stat.key] ?? 0;
    const increase = Math.max(1, Math.ceil(currentValue * 0.1));
    updatedEmployee = {
      ...updatedEmployee,
      [stat.key]: currentValue + increase,
    };
    statMessages.push(`${stat.label}+${increase}`);
  });

  return {
    employee: updatedEmployee,
    wasMaxAwakening: false,
    statMessages,
    beforeAwakening: currentAwakening,
    afterAwakening: currentAwakening + 1,
  };
}

function confirmRecruitApplicant(applicant) {
  if (!employeeRecruitmentOffer) return;

  if (!applicant.opened) {
    alert("先に封筒を開封してください。");
    return;
  }

  const ownedEmployeeInfo = findOwnedEmployeeById(applicant.id);

  if (ownedEmployeeInfo) {
    const awakeningPreview = awakenEmployee(ownedEmployeeInfo.employee);
    const ok = window.confirm(
      `${applicant.name}はすでに在籍・保管中です。\n\n` +
        `同じ社員を採用扱いにして覚醒しますか？\n` +
        `覚醒: +${awakeningPreview.beforeAwakening} → +${awakeningPreview.afterAwakening}\n` +
        `${awakeningPreview.statMessages.join(" / ")}`
    );

    if (!ok) return;

    if (ownedEmployeeInfo.location === "assigned") {
      setEmployees((currentEmployees) => {
        return currentEmployees.map((employee) => {
          if (employee.id !== applicant.id) return employee;
          return awakeningPreview.employee;
        });
      });
    } else {
      setEmployeeStorage((currentStorage) => {
        return currentStorage.map((employee) => {
          if (employee.id !== applicant.id) return employee;
          return awakeningPreview.employee;
        });
      });
    }

    setEmployeeRecruitmentOffer(null);
    setEmployeeGachaResult(null);
    setLog(
      `${applicant.name}がダブりました。覚醒+${awakeningPreview.afterAwakening}になりました。${awakeningPreview.statMessages.join(" / ")}`
    );
    return;
  }

  const ok = window.confirm(
    `${applicant.name}を採用しますか？\n\n` +
      `レアリティ: ${applicant.rarity}\n` +
      `統率: ${applicant.leadership}\n` +
      `営業: ${applicant.sales}\n` +
      `建築: ${applicant.construction}\n` +
      `管理: ${applicant.management}\n` +
      `月給: ${applicant.salary}万円\n` +
      `特殊能力: ${getEmployeeSpecialText(applicant)}\n\n` +
      `残りの履歴書4枚とは縁がなかったことになります。`
  );

  if (!ok) return;

  const storedEmployee = normalizeEmployeeGrowthBase({
    ...applicant,
    envelopeId: undefined,
    envelopeType: undefined,
    opened: undefined,
    officeId: null,
  });

  setEmployeeStorage([
    ...employeeStorage,
    storedEmployee,
  ]);
  setEmployeeRecruitmentOffer(null);
  setEmployeeGachaResult(null);

  setLog(`${storedEmployee.name}（${storedEmployee.rarity}）を採用しました。社員保管庫に追加されました。`);
}

function addEmployeeTicketForDemo() {
  setEmployeeTickets(employeeTickets + 1);
  setLog("デモ用に社員チケットを1枚追加しました。");
}

function addPremiumEmployeeTicketForDemo() {
  setPremiumEmployeeTickets(premiumEmployeeTickets + 1);
  setLog("デモ用に社員プレミアムチケットを1枚追加しました。SR以上確定です。");
}

function addDemoMoney100m() {
  if (!isDemoMode) return;

  setMoney((current) => current + 10000);
  setLog("デモ版：所持金を1億円追加しました。");
}


function grantTicketReward(ticketType, count, reason, showPopup = true) {
  const amount = Math.max(1, count ?? 1);

  if (ticketType === "premium") {
    setPremiumEmployeeTickets((current) => current + amount);
  } else {
    setEmployeeTickets((current) => current + amount);
  }

  const reward = {
    ticketType,
    count: amount,
    reason,
  };

  if (showPopup) {
    setTicketRewardResult(reward);
  }

  setLog(`${reason}：${ticketType === "premium" ? "社員プレミアムチケット" : "社員チケット"}を${amount}枚獲得しました。`);
}

function handleDeveloperCommand() {
  const command = normalizeCommandText(developerCommandInput);

  if (!command) return;

  if (command === "野口コーポレーション") {
    setIsDemoMode((current) => {
      const next = !current;
      setLog(next ? "デモモードをONにしました。" : "デモモードをOFFにしました。");
      return next;
    });
    setDeveloperCommandInput("");
    return;
  }

  if (command === "岐阜" || command === "ギフ") {
    if (usedSecretCommands.gifu) {
      alert("このコマンドはすでに使用済みです。使用できるのは1回だけです。");
      return;
    }

    setUsedSecretCommands((current) => ({ ...current, gifu: true }));
    grantTicketReward("normal", 1, "隠しコマンド", true);
    setDeveloperCommandInput("");
    return;
  }

  if (command === "瑞穂" || command === "ミズホ") {
    if (usedSecretCommands.mizuho) {
      alert("このコマンドはすでに使用済みです。使用できるのは1回だけです。");
      return;
    }

    setUsedSecretCommands((current) => ({ ...current, mizuho: true }));
    grantTicketReward("premium", 1, "隠しコマンド", true);
    setDeveloperCommandInput("");
    return;
  }

  if (command === "一億円" || command === "1億円"|| command === "１億円") {
    if (usedSecretCommands.money100m) {
      alert("このコマンドはすでに使用済みです。使用できるのは1回だけです。");
      return;
    }

    setUsedSecretCommands((current) => ({ ...current, money100m: true }));
    setMoney((current) => current + 10000);
    setLog("隠しコマンド：所持金が1億円増えました。");
    setDeveloperCommandInput("");
    return;
  }

  alert("コマンドが違います。");
}

function assignStoredEmployee(employee, officeId) {
  const alreadyAssigned = employees.some((item) => item.id === employee.id);

  if (alreadyAssigned) {
    alert("この社員はすでに配属されています");
    return;
  }

  const targetCount = employees.filter((item) => {
    return (item.officeId ?? "hq") === officeId;
  }).length;

  if (targetCount >= MAX_EMPLOYEES_PER_OFFICE) {
    alert("配属先の社員枠が満員です");
    return;
  }

  const officeName = getOfficeName(officeId);

  setEmployees([
    ...employees,
    {
      ...employee,
      officeId,
    },
  ]);

  setEmployeeStorage(
    employeeStorage.filter((item) => item.id !== employee.id)
  );

  setLog(`${employee.name}を${officeName}へ配属しました。`);
}

function unassignEmployee(employee) {
  const ok = window.confirm(
    `${employee.name}を配属から外して、社員保管庫へ戻しますか？`
  );

  if (!ok) return;

  setEmployees(
    employees.filter((item) => item.id !== employee.id)
  );

  setEmployeeStorage([
    ...employeeStorage,
    {
      ...employee,
      officeId: null,
    },
  ]);

  setLog(`${employee.name}を社員保管庫へ戻しました。`);
}

function hireEmployee(employee) {
  if (employees.length >= employeeLimit) {
    alert(`社員は最大${employeeLimit}人まで雇用できます。支店を開設すると上限が増えます。`);
    return;
  }

  const alreadyHired = employees.some((item) => item.id === employee.id);

  if (alreadyHired) {
    alert("この社員はすでに雇用しています");
    return;
  }

  const targetOffice = getFirstAvailableOffice();

  if (!targetOffice) {
    alert("配属できる空き事務所がありません。支店を開設してください。");
    return;
  }

  const targetOfficeId = targetOffice.officeId ?? "hq";
  const targetOfficeName = targetOffice.officeName ?? targetOffice.hqName ?? "本社";

  const ok = window.confirm(
    `${employee.name}を採用しますか？\n\n` +
      `レアリティ: ${employee.rarity}\n` +
      `営業: ${employee.sales}\n` +
      `建築: ${employee.construction}\n` +
      `管理: ${employee.management}\n` +
      `月給: ${employee.salary}万円\n` +
      `所属: ${targetOfficeName}\n` +
      `特殊能力: ${getEmployeeSpecialText(employee)}`
  );

  if (!ok) return;

  setEmployees([
    ...employees,
    {
      ...employee,
      officeId: targetOfficeId,
    },
  ]);

  setEmployeeCandidates(
    employeeCandidates.filter((candidate) => candidate.id !== employee.id)
  );

  setLog(`${employee.name}を採用しました。月給${employee.salary}万円 / 所属:${targetOfficeName} / 特殊能力:${getEmployeeSpecialText(employee)}`);
}

function dismissEmployee(employee) {
  unassignEmployee(employee);
}

function startBuildPlacement(buildingKey) {
  const building = BUILDINGS[buildingKey];

  if (!building) {
    alert("建物を選択してください");
    return;
  }

  if (!hqPlaced) {
    alert("先に本社を設置してください");
    return;
  }

  setPendingBuildKey(buildingKey);
  setPendingBranchPlacement(false);
  setSelectedId(null);
  setActivePanel("build");
  setLog(`${building.name}を建設する土地を選択中です。マップ上の緑色の自分の空き土地をクリックしてください。`);
  alert(`${building.name}を建設する土地を選んでください。\n\n建設可能な土地は緑枠で表示されます。\n建てたい土地をマップ上でクリックすると建設確認に進みます。`);
}

function startBranchPlacement() {
  if (!hqPlaced) {
    alert("先に本社を設置してください");
    return;
  }

  if (!canOpenNextBranchByEmployeeCount) {
    alert(`次の支店開設には、本社・支店に配属中の社員が合計${nextBranchRequiredEmployeeCount}人以上必要です。`);
    return;
  }

  setPendingBranchPlacement(true);
  setPendingBuildKey(null);
  setSelectedId(null);
  setSelectedBuildCategory("支店");
  setActivePanel("build");
  setLog("支店を建てる土地を選択中です。マップ上の緑枠の自分の空き土地をクリックしてください。");
  alert("支店を建てる土地を選んでください。\n\n開設可能な土地は緑枠で表示されます。\n建てたい土地をマップ上でクリックすると支店開設確認に進みます。");
}

async function buyLand() {
  if (!hqPlaced) {
  alert("先に本社を設置してください");
  return;
}
  if (!selectedTile) return;

  const mainTile = getMainTile(selectedTile);

  if (selectedTile.owner !== OWNER.SALE && mainTile?.owner !== OWNER.SALE) {
    alert("購入できるのは『売り物件』だけです");
    return;
  }

  const targetTile = mainTile || selectedTile;

  const relatedTiles = tiles.filter(
    (tile) => tile.id === targetTile.id || tile.buildingMainId === targetTile.id
  );

  const hasOutOfRangeTile = relatedTiles.some((tile) => {
    return !isTileInOfficeRange(tile);
  });

  if (hasOutOfRangeTile) {
    alert("本社・支店の行動範囲外のため購入できません");
    return;
  }

  const landTotal = relatedTiles.reduce((sum, tile) => {
    return sum + tile.landPrice;
  }, 0);

  const buildingValue = calculateBuildingValue(targetTile);

  const purchasePrice = landTotal + buildingValue;

  if (targetTile.purchaseStatus === "purchasing") {
    alert("この土地・物件はすでに購入交渉中です");
    return;
  }

  const actionEmployees = await chooseActionEmployees("土地購入", {
    maxCount: 4,
    baseMonths: 2,
    statKey: "sales",
    targetTile,
  });

  if (actionEmployees.length === 0) return;

  const plannedMonths = estimateActionMonths(2, actionEmployees, "sales");
  const finalPurchasePrice = calculateActionCost(purchasePrice, actionEmployees, "sales");

  if (finalPurchasePrice > money) {
    alert(`資金不足のため購入できません。\n\n必要額: ${finalPurchasePrice}万円\n現在資金: ${money}万円`);
    return;
  }

  const ok = window.confirm(
    `購入交渉を開始しますか？\n\n` +
      `標準価格: ${purchasePrice}万円\n` +
      `購入予定価格: ${finalPurchasePrice}万円\n` +
      `標準期間: 2ヶ月\n` +
      `予定期間: 約${plannedMonths}ヶ月\n` +
      `担当: ${actionEmployees.map((employee) => employee.name).join("・")}`
  );

  if (!ok) return;

  setTiles(
    tiles.map((tile) => {
      if (tile.id === targetTile.id) {
        return {
          ...tile,
          purchaseStatus: "purchasing",
          purchaseMonthsLeft: plannedMonths,
          purchaseBaseMonths: 2,
          purchasePlannedMonths: plannedMonths,
          purchaseBasePrice: purchasePrice,
          purchaseFinalPrice: finalPurchasePrice,
          purchaseEmployeeIds: actionEmployees.map((employee) => employee.id),
          purchaseEmployeeNames: actionEmployees.map((employee) => employee.name),
        };
      }

      return tile;
    })
  );

  markEmployeesBusy(actionEmployees.map((employee) => employee.id), plannedMonths, "土地購入");

  setLog(
    `${targetTile.building ? BUILDINGS[targetTile.building].name : "土地"}の購入交渉を開始しました。` +
      `標準2ヶ月 → 予定${plannedMonths}ヶ月 / 標準${purchasePrice}万円 → 予定${finalPurchasePrice}万円 / ` +
      `担当:${actionEmployees.map((employee) => employee.name).join("・")}`
  );
}
function placeHQ(hqTypeKey) {
  const alreadyHasHQ = tiles.some((tile) => {
    return tile.owner === OWNER.PLAYER && tile.feature === FEATURE.HQ;
  });

  if (alreadyHasHQ) {
    alert("本社はすでに設置済みです。2つ目の本社は設置できません。");
    setHqPlaced(true);
    setActivePanel("home");
    return;
  }

  if (selectedId == null) {
    alert("土地を選択してください");
    return;
  }

  const hqType = HQ_TYPES[hqTypeKey];

  if (!hqType) {
    alert("本社タイプを選択してください");
    return;
  }

  const tile = tiles.find((t) => t.id === selectedId);

  if (!tile) return;

  if (tile.owner !== OWNER.SALE) {
    alert("売り土地のみ本社設置できます");
    return;
  }

  if (!isBuildableTile(tile)) {
    alert("ここには本社を置けません");
    return;
  }

  const totalCost = tile.landPrice + hqType.cost;

  const ok = window.confirm(
    `${hqType.name}を設置しますか？\n\n` +
      `土地代: ${tile.landPrice}万円\n` +
      `本社建設費: ${hqType.cost}万円\n` +
      `合計: ${totalCost}万円`
  );

  if (!ok) return;

  if (money < totalCost) {
    alert(`必要資金${totalCost}万円に対して資金不足です`);
    return;
  }

  const rooms =
    hqTypeKey === "apartment"
      ? Array.from({ length: hqType.rooms }, (_, index) => {
          const tenantKey =
            hqType.allowedTenants[
              randomInt(0, hqType.allowedTenants.length - 1)
            ];

          const tenant = TENANT_TYPES[tenantKey];
          const occupied = Math.random() < 0.5;

          return {
            roomNo: index + 1,
            tenantType: occupied ? tenantKey : null,
            people: occupied
              ? randomInt(tenant.peopleMin, tenant.peopleMax)
              : 0,
            rent: hqType.baseRent,
            contractRent: occupied ? hqType.baseRent : null,
            contractStartMonth: occupied ? month : null,
            lastRentReviewMonth: occupied ? month : null,
            occupied,
            tenantMonths: 0,
          };
        })
      : [];

  const updatedTiles = tiles.map((t) => {
    if (t.id !== selectedId) return t;

    return {
      ...t,
      owner: OWNER.PLAYER,
      feature: FEATURE.HQ,
      officeId: "hq",
      officeName: "本社",
      officeRange: HQ_ACTION_RANGE,
      hqType: hqTypeKey,
      hqName: hqType.name,
      hqCost: hqType.cost,
      building: hqTypeKey === "apartment" ? "hq_apartment" : null,
      buildingMainId: null,
      rooms,
      age: 0,
      condition: 100,
      leaseCycleStartMonth: month,
    };
  });

  setMoney(money - totalCost);
  setTiles(updatedTiles);
  setHqPlaced(true);
  setActionPoints(Math.max(actionPoints, 1));
  setSelectedId(null);
  setActivePanel("employee");

  setLog(
    `${hqType.name}を設置しました。土地代${tile.landPrice}万円、本社建設費${hqType.cost}万円を支払いました。`
  );
}
async function placeBranch(targetTile = selectedTile) {
  if (!hqPlaced) {
    alert("先に本社を設置してください");
    return false;
  }

  const branchTargetTile = targetTile;

  if (!branchTargetTile) {
    alert("支店を建てる土地を選択してください");
    return false;
  }

  if (officeTiles.some((officeTile) => officeTile.feature === FEATURE.BRANCH && officeTile.branchUnderConstruction)) {
    alert("現在建設中の支店があります。支店完成後に次の支店を開設できます");
    return false;
  }

  if (!canOpenNextBranchByEmployeeCount) {
    alert(`次の支店開設には、本社・支店に配属中の社員が合計${nextBranchRequiredEmployeeCount}人以上必要です。`);
    return false;
  }

  if (branchTargetTile.owner !== OWNER.PLAYER) {
    alert("支店は自分の空き土地にのみ建設できます");
    return false;
  }

  if (!isBuildableTile(branchTargetTile)) {
    alert("ここには支店を建てられません");
    return false;
  }

  if (branchTargetTile.building || branchTargetTile.buildingMainId) {
    alert("建物がある土地には支店を建てられません");
    return false;
  }

  if (!isTileInOfficeRange(branchTargetTile)) {
    alert("本社・支店の行動範囲外のため支店を開設できません");
    return false;
  }

  if (money < BRANCH_OFFICE_COST) {
    alert(`支店開設費${BRANCH_OFFICE_COST}万円が足りません`);
    return false;
  }

  const nearestOfficeDistance = officeTiles.reduce((minDistance, officeTile) => {
    return Math.min(
      minDistance,
      getDistance(branchTargetTile.x, branchTargetTile.y, officeTile.x, officeTile.y)
    );
  }, 999);

  if (nearestOfficeDistance < OFFICE_MIN_DISTANCE) {
    alert("支店は本社・支店の行動範囲内であれば開設できます。近すぎると営業範囲が広がりにくい点に注意してください。");
    return false;
  }

  const nextBranchNumber = branchCount + 1;
  const officeId = `branch_${Date.now()}`;
  const officeName = `支店${nextBranchNumber}`;

  const actionEmployees = await chooseActionEmployees("支店開設", {
    maxCount: 4,
    baseMonths: BRANCH_OFFICE_BASE_MONTHS,
    statKey: "construction",
    targetTile: branchTargetTile,
  });

  if (actionEmployees.length === 0) return false;

  const branchBuildMonths = estimateActionMonths(BRANCH_OFFICE_BASE_MONTHS, actionEmployees, "construction");
  const actualBranchCost = calculateActionCost(BRANCH_OFFICE_COST, actionEmployees, "construction");

  const ok = window.confirm(
    `${officeName}を開設しますか？\n\n` +
      `標準建築費: ${BRANCH_OFFICE_COST}万円\n` +
      `予定建築費: ${actualBranchCost}万円\n` +
      `社員上限: +${MAX_EMPLOYEES_PER_OFFICE}人\n` +
      `営業範囲: ${BRANCH_ACTION_RANGE}マス\n` +
      `担当: ${actionEmployees.map((employee) => employee.name).join("・")}\n` +
      `標準工期: ${BRANCH_OFFICE_BASE_MONTHS}ヶ月\n` +
      `予定工期: 約${branchBuildMonths}ヶ月`
  );

  if (!ok) return false;

  if (money < actualBranchCost) {
    alert(`支店予定建築費${actualBranchCost}万円が足りません`);
    return false;
  }

  setMoney(money - actualBranchCost);

  setTiles(
    tiles.map((tile) => {
      if (tile.id !== branchTargetTile.id) return tile;

      return {
        ...tile,
        owner: OWNER.PLAYER,
        feature: FEATURE.BRANCH,
        officeId,
        officeName,
        branchNumber: nextBranchNumber,
        officeRange: 0,
        branchUnderConstruction: true,
        branchBuildRemaining: branchBuildMonths,
        branchStandardMonths: BRANCH_OFFICE_BASE_MONTHS,
        branchActualMonths: branchBuildMonths,
        branchStandardCost: BRANCH_OFFICE_COST,
        branchActualCost: actualBranchCost,
        branchEmployeeIds: actionEmployees.map((employee) => employee.id),
        branchEmployeeNames: actionEmployees.map((employee) => employee.name),
      };
    })
  );

  setPendingBranchPlacement(false);
  setSelectedId(null);
  markEmployeesBusy(actionEmployees.map((employee) => employee.id), branchBuildMonths, "支店開設");

  setLog(`${officeName}の建設を開始しました。標準${BRANCH_OFFICE_BASE_MONTHS}ヶ月 → 予定${branchBuildMonths}ヶ月 / 標準${BRANCH_OFFICE_COST}万円 → 予定${actualBranchCost}万円 / 担当:${actionEmployees.map((employee) => employee.name).join("・")}`);
  return true;
}

  async function build(buildingKey, targetTile = selectedTile) {
    if (!hqPlaced) {
  alert("先に本社を設置してください");
  return false;
}
    const clickedBuildTargetTile = targetTile;

    if (!clickedBuildTargetTile) return false;

    const building = BUILDINGS[buildingKey];

    const buildTargetTile = getResolvedBuildStartTile(clickedBuildTargetTile, buildingKey) ?? clickedBuildTargetTile;

    if (!isBuildingUnlockedForRank(buildingKey, playerRank)) {
      alert(`${building.name}はプレイヤーランク${getRequiredRankForBuilding(buildingKey)}で解放されます。`);
      return false;
    }

const zone = buildTargetTile.zone;

// 住宅地域
if (zone === ZONE.RESIDENTIAL) {
  if (
    building.category === "商業" &&
    buildingKey !== "small_shop"
  ) {
    alert("住宅地域では大型商業施設は建築できません");
    return false;
  }
}

// 工業地域
if (zone === ZONE.INDUSTRIAL) {
  if (
    buildingKey === "mansion_7f"
  ) {
    alert("工業地域では高層マンションは建築できません");
    return false;
  }
}
    if (buildTargetTile.owner !== OWNER.PLAYER) {
      alert("自分の土地を選んでください");
      return false;
    }

    if (!isTileInOfficeRange(buildTargetTile)) {
      alert("本社・支店の行動範囲外のため建設できません");
      return false;
    }

    if (!isBuildingAreaInOfficeRange(buildTargetTile, buildingKey)) {
      alert("建物予定地の一部が本社・支店の行動範囲外です");
      return false;
    }

    const placement = canPlaceBuilding(buildTargetTile, buildingKey);

if (!placement.ok) {
      alert(
        `${building.name}は${building.width}×${building.height}マス必要です。範囲内の土地をすべて自分で所有し、空地にしてください。`
      );
      return false;
    }

    if (money < building.cost) {
      alert("建築費が足りません");
      return false;
    }

    const actionEmployees = await chooseActionEmployees("建設", {
      maxCount: 4,
      baseMonths: building.buildMonths || 1,
      statKey: "construction",
      targetTile: buildTargetTile,
    });

    if (actionEmployees.length === 0) return false;

    const standardBuildMonths = building.buildMonths || 1;
    const buildMonths = estimateActionMonths(standardBuildMonths, actionEmployees, "construction");
    const actualBuildCost = calculateActionCost(building.cost, actionEmployees, "construction");

const ok = window.confirm(
  `${building.name}を建設しますか？\n\n` +
    `標準建築費: ${building.cost}万円\n` +
    `予定建築費: ${actualBuildCost}万円\n` +
    `戸数: ${building.rooms}戸\n` +
    `1戸賃料: ${building.baseRent}万円\n` +
    `満室想定: ${building.baseRent * building.rooms}万円\n` +
    `必要マス: ${placement.width}×${placement.height}\n` +
    `標準工期: ${standardBuildMonths}ヶ月\n` +
    `予定工期: 約${buildMonths}ヶ月\n` +
    `担当: ${actionEmployees.map((employee) => employee.name).join("・")}`
);

if (!ok) return false;
    const demand = getDemand(buildTargetTile, buildingKey);

    if (money < actualBuildCost) {
      alert(`建築予定費${actualBuildCost}万円が足りません`);
      return false;
    }

    setMoney(money - actualBuildCost);

    setTiles(
      tiles.map((tile) => {
        const inArea =
          tile.x >= buildTargetTile.x &&
          tile.x < buildTargetTile.x + placement.width &&
          tile.y >= buildTargetTile.y &&
          tile.y < buildTargetTile.y + placement.height;

        if (!inArea) return tile;

if (tile.id === buildTargetTile.id) {
  return {
    ...tile,
    building: buildingKey,
    buildingMainId: null,
    rooms: [],

buildingStatus: "constructing",
buildRemaining: buildMonths,
buildStandardMonths: standardBuildMonths,
buildActualMonths: buildMonths,
buildStandardCost: building.cost,
buildActualCost: actualBuildCost,
buildEmployeeNames: actionEmployees.map((employee) => employee.name),
buildEmployeeIds: actionEmployees.map((employee) => employee.id),
age: 0,
condition: 100,
vacancyMonths: 0,
recoveryMode: false,
leaseCycleStartMonth: month,
  };
}

return {
  ...tile,
  building: buildingKey,
  buildingMainId: buildTargetTile.id,
  rooms: [],

buildingStatus: "constructing",
buildRemaining: buildMonths,
buildStandardMonths: standardBuildMonths,
buildActualMonths: buildMonths,
buildStandardCost: building.cost,
buildActualCost: actualBuildCost,
buildEmployeeNames: actionEmployees.map((employee) => employee.name),
buildEmployeeIds: actionEmployees.map((employee) => employee.id),
age: 0,
condition: 100,
vacancyMonths: 0,
recoveryMode: false,
leaseCycleStartMonth: month,
};
      })
    );

    setPendingBuildKey(null);
    markEmployeesBusy(actionEmployees.map((employee) => employee.id), buildMonths, "建設");
    setLog(`${building.name}の建設を開始しました。標準${standardBuildMonths}ヶ月 → 予定${buildMonths}ヶ月 / 標準${building.cost}万円 → 予定${actualBuildCost}万円 / 担当:${actionEmployees.map((employee) => employee.name).join("・")}`);
    return true;
  }

async function demolish() {
  if (!selectedTile) return;

  const mainTile = getMainTile(selectedTile);

  // 本社は解体禁止
  if (mainTile?.feature === FEATURE.HQ) {
    alert("本社は取り壊しできません");
    return;
  }

  if (!mainTile || mainTile.owner !== OWNER.PLAYER || !mainTile.building) {
    alert("取り壊せる建物がありません");
    return;
  }

  const building = BUILDINGS[mainTile.building];
  const demolishCost = Math.max(20, Math.floor(building.cost * 0.08));

  if (money < demolishCost) {
    alert(`取り壊し費用${demolishCost}万円が足りません`);
    return;
  }

  const actionEmployee = await chooseActionEmployee("取り壊し", { targetTile: mainTile });

  if (!actionEmployee) return;

  const ok = window.confirm(
    `${building.name}を取り壊しますか？ 費用は${demolishCost}万円です。`
  );

  if (!ok) return;

  setMoney(money - demolishCost);

  setTiles(
    tiles.map((tile) => {
      if (tile.id === mainTile.id || tile.buildingMainId === mainTile.id) {
        return {
          ...tile,
          building: null,
          buildingMainId: null,
          rooms: [],
          buildingStatus: null,
          buildRemaining: 0,
        };
      }

      return tile;
    })
  );
  grantEmployeeExp(
    actionEmployee.id,
    calculateMoneyActionExp(demolishCost),
    "取り壊し"
  );
  setLog(`${building.name}を取り壊しました。担当:${actionEmployee.name}`);
}
async function sellProperty() {
  if (!selectedTile) return;

  const mainTile = getMainTile(selectedTile);

  if (!mainTile || mainTile.owner !== OWNER.PLAYER) {
    alert("売却できる自分の土地・建物がありません");
    return;
  }

  if (mainTile.feature === FEATURE.HQ) {
    alert("本社は売却できません");
    return;
  }

  if (mainTile.buildingStatus === "constructing") {
    alert("建設中の物件は売却できません");
    return;
  }

  if (mainTile.repairStatus === "repairing") {
    alert("修繕中の物件は売却できません");
    return;
  }

  const isBranchSale = mainTile.feature === FEATURE.BRANCH;

  if (isBranchSale) {
    const branchOfficeId = mainTile.officeId;
    const branchEmployees = employees.filter((employee) => {
      return (employee.officeId ?? "hq") === branchOfficeId;
    });

    if (branchEmployees.length > 0) {
      alert(
        `${mainTile.officeName ?? "支店"}には社員が${branchEmployees.length}人在籍しています。\n\n` +
          "支店を売却する前に、所属社員を本社・他支店へ異動するか、退職させてください。"
      );
      return;
    }

    const employeeLimitAfterSale = Math.max(
      0,
      (officeTiles.length - 1) * MAX_EMPLOYEES_PER_OFFICE
    );

    if (employees.length > employeeLimitAfterSale) {
      const overCount = employees.length - employeeLimitAfterSale;

      alert(
        `${mainTile.officeName ?? "支店"}を売却すると社員上限が${employeeLimitAfterSale}人になります。\n\n` +
          `現在社員が${employees.length}人いるため、先に${overCount}人分の退職または別支店開設が必要です。`
      );
      return;
    }
  }

  const relatedTiles = tiles.filter(
    (tile) => tile.id === mainTile.id || tile.buildingMainId === mainTile.id
  );

  const landTotal = relatedTiles.reduce((sum, tile) => {
    return sum + tile.landPrice;
  }, 0);

  const buildingValue = isBranchSale ? 0 : calculateBuildingValue(mainTile);

  const salePrice = Math.round((landTotal + buildingValue) * 0.9);

  const propertyName = isBranchSale
    ? mainTile.officeName ?? "支店"
    : mainTile.building
      ? BUILDINGS[mainTile.building].name
      : "土地";

  const actionEmployee = await chooseActionEmployee("売却", { targetTile: mainTile });

  if (!actionEmployee) return;

  const ok = window.confirm(
    `${propertyName}を売却しますか？\n\n` +
      `土地評価額: ${landTotal}万円\n` +
      `建物評価額: ${buildingValue}万円\n` +
      `売却価格: ${salePrice}万円\n\n` +
      (isBranchSale
        ? "※売却後は他人所有の空き地になり、支店機能と営業範囲は消えます。"
        : "※売却後は他人所有になります")
  );

  if (!ok) return;

  setMoney(money + salePrice);

  setTiles(
    tiles.map((tile) => {
      if (tile.id === mainTile.id || tile.buildingMainId === mainTile.id) {
        return {
          ...tile,
          owner: OWNER.OTHER,
          feature: FEATURE.NONE,
          officeId: null,
          officeName: null,
          officeRange: null,
          hqType: null,
          hqName: null,
          hqCost: null,
          building: null,
          buildingMainId: null,
          rooms: [],
          buildingStatus: null,
          buildRemaining: 0,
          repairStatus: null,
          repairName: null,
          repairMonthsLeft: 0,
          repairConditionUp: 0,
        };
      }

      return tile;
    })
  );

  setSelectedId(null);
  grantEmployeeExp(
    actionEmployee.id,
    calculateMoneyActionExp(salePrice),
    "売却"
  );
  setLog(`${propertyName}を${salePrice}万円で売却しました。売却後は他人所有の空き地になりました。担当:${actionEmployee.name}`);
}
const REPAIR_OPTIONS = {
  light: {
    name: "軽修繕",
    costRate: 0.03,
    conditionUp: 15,
    months: 1,
  },
  exterior: {
    name: "外装工事",
    costRate: 0.05,
    conditionUp: 30,
    months: 2,
  },
  major: {
    name: "大規模修繕",
    costRate: 0.12,
    conditionUp: 60,
    months: 4,
  },
};

async function repairBuilding(type) {
  if (!selectedTile) return;

  const mainTile = getMainTile(selectedTile);
  const option = REPAIR_OPTIONS[type];

  if (!mainTile || mainTile.owner !== OWNER.PLAYER || !mainTile.building) {
    alert("修繕できる建物がありません");
    return;
  }

  if (mainTile.buildingStatus === "constructing") {
    alert("建設中の建物は修繕できません");
    return;
  }

  const building = BUILDINGS[mainTile.building];

  let standardRepairCost = Math.max(
    30,
    Math.round(building.cost * option.costRate)
  );

  const hqDistance = getHQDistance(mainTile);

  if (hqDistance <= 5) {
    standardRepairCost = Math.round(standardRepairCost * 0.5);
  }

  const nextCondition = Math.min(
    100,
    Math.round((mainTile.condition ?? 100) + option.conditionUp)
  );

  const actionEmployees = await chooseActionEmployees("修繕", {
    maxCount: 4,
    baseMonths: option.months,
    statKey: "construction",
    targetTile: mainTile,
  });

  if (actionEmployees.length === 0) return;

  const actualRepairMonths = estimateActionMonths(option.months, actionEmployees, "construction");
  const actualRepairCost = calculateActionCost(standardRepairCost, actionEmployees, "construction");

  const ok = window.confirm(
    `${building.name}に${option.name}を行いますか？\n\n` +
      `標準費用: ${standardRepairCost}万円\n` +
      `予定費用: ${actualRepairCost}万円\n` +
      `効果: 建物状態 +${option.conditionUp}%\n` +
      `標準工期: ${option.months}ヶ月\n` +
      `予定工期: ${actualRepairMonths}ヶ月\n` +
      `建物状態: ${Math.round(mainTile.condition ?? 100)}% → ${nextCondition}%`
  );

  if (!ok) return;

  if (money < actualRepairCost) {
    alert(`費用${actualRepairCost}万円が足りません`);
    return;
  }

  setMoney(money - actualRepairCost);

  setTiles(
    tiles.map((tile) => {
      if (tile.id === mainTile.id || tile.buildingMainId === mainTile.id) {
        return {
          ...tile,
          repairStatus: "repairing",
          repairName: option.name,
          repairMonthsLeft: actualRepairMonths,
          repairConditionUp: option.conditionUp,
          repairStandardMonths: option.months,
          repairActualMonths: actualRepairMonths,
          repairStandardCost: standardRepairCost,
          repairActualCost: actualRepairCost,
          repairEmployeeIds: actionEmployees.map((employee) => employee.id),
          repairEmployeeNames: actionEmployees.map((employee) => employee.name),
        };
      }

      return tile;
    })
  );

  grantEmployeesExp(
    actionEmployees.map((employee) => employee.id),
    calculateMonthActionExp(actualRepairMonths),
    "修繕"
  );
  markEmployeesBusy(actionEmployees.map((employee) => employee.id), actualRepairMonths, "修繕");

  setLog(
    `${building.name}の${option.name}を開始しました。標準${option.months}ヶ月 → 予定${actualRepairMonths}ヶ月 / 標準${standardRepairCost}万円 → 予定${actualRepairCost}万円 / 担当:${actionEmployees.map((employee) => employee.name).join("・")}`
  );
}

function nextMonth() {
    const nextProcessingMonth = month + 1;
    let income = 0;
    let maintenance = 0;
    const eventLog = [];
    let newFactoryProjects = [...factoryProjects];
let newStationProjects = [...stationProjects];
let workingTiles = [...tiles];

// v82軽量化：翌月処理中に何度も全タイル検索しないための軽量キャッシュ。
// 機能は残しつつ、道路判定・周辺建物判定・NPC成長判定の重複走査を減らす。
const nextMonthTileByCoordinate = new Map(
  workingTiles.map((tile) => [`${tile.x},${tile.y}`, tile])
);
const nextMonthRoadCoordinateSet = new Set(
  workingTiles
    .filter((tile) => tile.feature === FEATURE.ROAD)
    .map((tile) => `${tile.x},${tile.y}`)
);
const nextMonthMainBuildingTiles = workingTiles.filter(
  (tile) => tile.building && !tile.buildingMainId
);
function hasRoadNearForNextMonth(x, y) {
  return (
    nextMonthRoadCoordinateSet.has(`${x + 1},${y}`) ||
    nextMonthRoadCoordinateSet.has(`${x - 1},${y}`) ||
    nextMonthRoadCoordinateSet.has(`${x},${y + 1}`) ||
    nextMonthRoadCoordinateSet.has(`${x},${y - 1}`) ||
    nextMonthRoadCoordinateSet.has(`${x},${y}`)
  );
}
function countNearbyMainBuildingsForNextMonth(x, y, range = 3) {
  let count = 0;
  nextMonthMainBuildingTiles.forEach((buildingTile) => {
    if (getDistance(x, y, buildingTile.x, buildingTile.y) <= range) {
      count += 1;
    }
  });
  return count;
}

if (Math.random() < 0.03) {

const candidateTiles = workingTiles.filter(
  (t) =>
    canPlaceFactoryProject3x3(t, workingTiles) &&

    (
      t.zone === ZONE.INDUSTRIAL ||
      t.zone === ZONE.GENERAL
    ) &&

    getDistance(t.x, t.y, 14, 10) >= 5
);

  if (candidateTiles.length > 0) {

    const target =
      candidateTiles[randomInt(0, candidateTiles.length - 1)];

    newFactoryProjects.push({
      x: target.x,
      y: target.y,
      monthsLeft: 6,
    });

    eventLog.push(
      `工場誘致計画が発表されました (${target.x},${target.y})`
    );
    
workingTiles = workingTiles.map((tile) => {
  const distance = getDistance(tile.x, tile.y, target.x, target.y);

  if (distance > 5) return tile;

  return {
    ...tile,
zone: ZONE.INDUSTRIAL,
landPrice: tile.landPrice + Math.max(0, 2500 - distance * 400),
  };
});
  }
}
if (Math.random() < 0.02) {
  const candidateTiles = workingTiles.filter(
    (t) =>
      t.rail === true &&
      t.terrain === TERRAIN.PLAIN &&
      !t.building &&
      t.feature !== FEATURE.STATION &&

      (
        t.zone === ZONE.COMMERCIAL ||
        t.zone === ZONE.GENERAL
      ) &&

[
  ...workingTiles.filter((tile) => tile.feature === FEATURE.STATION),
  ...newStationProjects,
].every(
  (station) =>
    getDistance(
      t.x,
      t.y,
      station.x,
      station.y
    ) >= 10
)
  );

  if (candidateTiles.length > 0) {
  const target =
    candidateTiles[randomInt(0, candidateTiles.length - 1)];

  newStationProjects.push({
    x: target.x,
    y: target.y,
    monthsLeft: 12,
  });

  eventLog.push(
    `新駅の整備計画が発表されました (${target.x},${target.y})`
  );
  workingTiles = workingTiles.map((tile) => {
  const distance = getDistance(tile.x, tile.y, target.x, target.y);

  if (distance > 4) return tile;

  return {
    ...tile,
    zone: ZONE.COMMERCIAL,
    landPrice: tile.landPrice + Math.max(0, 5000 - distance * 800),
  };
});
}
}
// v82軽量化：地価更新は仕様を残したまま、周辺探索を全件filterから座標Map参照に変更。
// 旧処理は「各タイル × 全タイル」で重かったため、半径5マス内だけを見る。
const tileByCoordinateForLandPrice = new Map(
  workingTiles.map((tile) => [`${tile.x},${tile.y}`, tile])
);
const nearbyOffsetsForLandPrice = [];
for (let dy = -5; dy <= 5; dy++) {
  for (let dx = -5; dx <= 5; dx++) {
    if (Math.abs(dx) + Math.abs(dy) <= 5) {
      nearbyOffsetsForLandPrice.push([dx, dy]);
    }
  }
}

workingTiles = workingTiles.map((tile) => {
  if (tile.terrain !== TERRAIN.PLAIN) return tile;

  let nearbyHousing = 0;
  let nearbyCommercial = 0;
  let nearbyIndustrial = 0;
  let nearbyStations = 0;
  let nearbyFactories = 0;
  let nearbyRoads = 0;
  let oldBuildings = 0;
  let badConditionBuildings = 0;
  let vacantRooms = 0;
  let totalRooms = 0;

  nearbyOffsetsForLandPrice.forEach(([dx, dy]) => {
    const nearbyTile = tileByCoordinateForLandPrice.get(`${tile.x + dx},${tile.y + dy}`);
    if (!nearbyTile) return;

    if (nearbyTile.feature === FEATURE.STATION) nearbyStations += 1;
    if (nearbyTile.feature === FEATURE.FACTORY) nearbyFactories += 1;
    if (nearbyTile.feature === FEATURE.ROAD) nearbyRoads += 1;

    if (nearbyTile.building && !nearbyTile.buildingMainId) {
      const building = BUILDINGS[nearbyTile.building];
      const category = building?.category;

      if (category === "住宅") nearbyHousing += 1;
      if (category === "商業") nearbyCommercial += 1;
      if (category === "工業") nearbyIndustrial += 1;

      if (building && (nearbyTile.age ?? 0) >= building.lifeYears * 0.9) {
        oldBuildings += 1;
      }

      if ((nearbyTile.condition ?? 100) < 55) {
        badConditionBuildings += 1;
      }

      if (nearbyTile.rooms) {
        totalRooms += nearbyTile.rooms.length;
        vacantRooms += nearbyTile.rooms.filter((room) => !room.occupied).length;
      }
    }
  });

  const localVacancyRate =
    totalRooms > 0 ? vacantRooms / totalRooms : 0;

  let targetLandPrice = 500;

  // 駅前は強い
  targetLandPrice += nearbyStations * 5000;

  // 道路は少しプラス
  targetLandPrice += Math.min(1200, nearbyRoads * 120);

  // 住宅がある地域は生活圏として少し上がる
  targetLandPrice += Math.min(1200, nearbyHousing * 120);

  // 商業施設は地価を強めに押し上げる
  targetLandPrice += Math.min(3500, nearbyCommercial * 450);

  // 工業は雇用効果で少し上がる
  targetLandPrice += Math.min(1600, nearbyIndustrial * 220);

  // 用途地域補正
  if (tile.zone === ZONE.RESIDENTIAL) {
    targetLandPrice += 800;
  }

  if (tile.zone === ZONE.COMMERCIAL) {
    targetLandPrice += 2000;
  }

  if (tile.zone === ZONE.INDUSTRIAL) {
    targetLandPrice += 900;
  }

  // 工場地帯は上がりすぎないようにする
  if (tile.zone === ZONE.INDUSTRIAL && nearbyFactories >= 1) {
    targetLandPrice -= 700;
  }

  // 住宅地で工場が近すぎる場合は下落
  if (tile.zone === ZONE.RESIDENTIAL && nearbyFactories >= 1) {
    targetLandPrice -= 1200;
  }

  // 空室が多い地域は下落
  if (localVacancyRate >= 0.25) {
    targetLandPrice -= 1000;
  }

  if (localVacancyRate >= 0.4) {
    targetLandPrice -= 1800;
  }

  // 築古・状態悪化が多い地域は下落
  targetLandPrice -= oldBuildings * 180;
  targetLandPrice -= badConditionBuildings * 220;

  // 町全体の需要が低いと下落
  if (cityDemandIndex < 45) {
    targetLandPrice -= 800;
  }

  if (cityDemandIndex < 38) {
    targetLandPrice -= 1500;
  }

  // 最低地価
  targetLandPrice = Math.max(100, Math.round(targetLandPrice));

  const gap = targetLandPrice - tile.landPrice;

  // 適正地価との差が小さいなら動かさない
  if (Math.abs(gap) < 50) {
    return tile;
  }

  // 毎月、適正地価へ少しだけ近づける
  const monthlyChange = Math.round(gap * 0.08);

  // 1ヶ月の変動幅を制限
  const limitedChange = Math.max(
    -500,
    Math.min(500, monthlyChange)
  );

  return {
    ...tile,
    landPrice: Math.max(100, tile.landPrice + limitedChange),
  };
});

let purchasePaymentTotal = 0;
const completedPurchaseMainIds = new Set();

workingTiles = workingTiles.map((tile) => {
  if (tile.purchaseStatus !== "purchasing") return tile;

  const remain = (tile.purchaseMonthsLeft ?? 1) - 1;

  if (remain > 0) {
    eventLog.push(`土地購入交渉中 (${tile.x},${tile.y}) 残り${remain}ヶ月`);
    return {
      ...tile,
      purchaseMonthsLeft: remain,
    };
  }

  const basePrice = tile.purchaseBasePrice ?? tile.landPrice ?? 0;
  const finalPrice = tile.purchaseFinalPrice ?? basePrice;
  const baseMonths = tile.purchaseBaseMonths ?? 2;
  const plannedMonths = tile.purchasePlannedMonths ?? baseMonths;
  const employeeNames = Array.isArray(tile.purchaseEmployeeNames) ? tile.purchaseEmployeeNames.join("・") : "-";
  const availableMoneyForPurchase = money - purchasePaymentTotal;

  if (finalPrice > availableMoneyForPurchase) {
    eventLog.push(
      `資金不足のため購入できませんでした (${tile.x},${tile.y})。必要:${finalPrice}万円 / 現在資金:${Math.max(0, availableMoneyForPurchase)}万円`
    );

    return {
      ...tile,
      purchaseStatus: null,
      purchaseMonthsLeft: 0,
      purchaseBaseMonths: 0,
      purchasePlannedMonths: 0,
      purchaseBasePrice: 0,
      purchaseFinalPrice: 0,
      purchaseEmployeeIds: [],
      purchaseEmployeeNames: [],
    };
  }

  purchasePaymentTotal += finalPrice;
  completedPurchaseMainIds.add(tile.id);

  eventLog.push(
    `土地を購入しました (${tile.x},${tile.y})。期間:${baseMonths}ヶ月→${plannedMonths}ヶ月 / 価格:${basePrice}万円→${finalPrice}万円 / 担当:${employeeNames}`
  );

  grantEmployeesExp(
    Array.isArray(tile.purchaseEmployeeIds) ? tile.purchaseEmployeeIds : [],
    calculateLandActionExp(finalPrice),
    "土地購入"
  );

  return {
    ...tile,
    owner: OWNER.PLAYER,
    purchaseStatus: null,
    purchaseMonthsLeft: 0,
    purchaseBaseMonths: 0,
    purchasePlannedMonths: 0,
    purchaseBasePrice: 0,
    purchaseFinalPrice: 0,
    purchaseEmployeeIds: [],
    purchaseEmployeeNames: [],
  };
});

if (completedPurchaseMainIds.size > 0) {
  workingTiles = workingTiles.map((tile) => {
    if (!completedPurchaseMainIds.has(tile.buildingMainId)) return tile;

    return {
      ...tile,
      owner: OWNER.PLAYER,
      purchaseStatus: null,
      purchaseMonthsLeft: 0,
      purchaseBaseMonths: 0,
      purchasePlannedMonths: 0,
      purchaseBasePrice: 0,
      purchaseFinalPrice: 0,
      purchaseEmployeeIds: [],
      purchaseEmployeeNames: [],
    };
  });
}


workingTiles = workingTiles.map((tile) => {
  if (!tile.branchUnderConstruction) return tile;

  const remain = (tile.branchBuildRemaining ?? 1) - 1;

  if (remain > 0) {
    eventLog.push(`${tile.officeName ?? "支店"} 建設中 残り${remain}ヶ月`);
    return {
      ...tile,
      branchBuildRemaining: remain,
    };
  }

  const employeeNames = Array.isArray(tile.branchEmployeeNames) ? tile.branchEmployeeNames.join("・") : "-";
  const employeeIds = Array.isArray(tile.branchEmployeeIds) ? tile.branchEmployeeIds : [];
  const standardMonths = tile.branchStandardMonths ?? BRANCH_OFFICE_BASE_MONTHS;
  const actualMonths = tile.branchActualMonths ?? standardMonths;
  const standardCost = tile.branchStandardCost ?? BRANCH_OFFICE_COST;
  const actualCost = tile.branchActualCost ?? standardCost;
  eventLog.push(`${tile.officeName ?? "支店"}が完成しました。工期:${standardMonths}ヶ月→${actualMonths}ヶ月 / 費用:${standardCost}万円→${actualCost}万円 / 担当:${employeeNames}`);
  grantEmployeesExp(employeeIds, calculateMonthActionExp(actualMonths), "支店完成");

  return {
    ...tile,
    branchUnderConstruction: false,
    branchBuildRemaining: 0,
    branchStandardMonths: 0,
    branchActualMonths: 0,
    branchStandardCost: 0,
    branchActualCost: 0,
    officeRange: BRANCH_ACTION_RANGE,
    branchEmployeeIds: [],
    branchEmployeeNames: [],
  };
});

    const updatedTiles = workingTiles.map((tile) => {
      if (tile.owner !== OWNER.PLAYER || !tile.building || tile.buildingMainId) {
        return tile;
      }

      const building = BUILDINGS[tile.building];
      maintenance += calculateMonthlyExpenses(tile);
      if (tile.repairStatus === "repairing") {
  const remain = (tile.repairMonthsLeft ?? 0) - 1;

  if (remain <= 0) {
    const nextCondition = Math.min(
      100,
      Math.round((tile.condition ?? 100) + (tile.repairConditionUp ?? 0))
    );

    eventLog.push(
      `${building.name}の${tile.repairName}が完了しました。建物状態:${Math.round(
        tile.condition ?? 100
      )}% → ${nextCondition}%`
    );

    return {
      ...tile,
      condition: nextCondition,
      repairStatus: null,
      repairName: null,
      repairMonthsLeft: 0,
      repairConditionUp: 0,
      repairStandardMonths: 0,
      repairActualMonths: 0,
      repairStandardCost: 0,
      repairActualCost: 0,
      repairEmployeeIds: [],
      repairEmployeeNames: [],
    };
  }

  eventLog.push(`${building.name} ${tile.repairName}中 残り${remain}ヶ月`);

  return {
    ...tile,
    repairMonthsLeft: remain,
  };
}

      const demand = getDemand(tile, tile.building);
const rentMultiplier = getRentMultiplier(tile, tile.building);

if (tile.buildingStatus === "constructing") {
  const remain = tile.buildRemaining - 1;

  if (remain <= 0) {
    const standardMonths = tile.buildStandardMonths ?? building.buildMonths ?? 1;
    const actualMonths = tile.buildActualMonths ?? standardMonths;
    const standardCost = tile.buildStandardCost ?? building.cost ?? 0;
    const actualCost = tile.buildActualCost ?? standardCost;
    const employeeNames = Array.isArray(tile.buildEmployeeNames) ? tile.buildEmployeeNames.join("・") : "-";
    const employeeIds = Array.isArray(tile.buildEmployeeIds) ? tile.buildEmployeeIds : [];
    eventLog.push(`${building.name}が完成しました。工期:${standardMonths}ヶ月→${actualMonths}ヶ月 / 費用:${standardCost}万円→${actualCost}万円 / 担当:${employeeNames}`);
    grantEmployeesExp(employeeIds, calculateMonthActionExp(actualMonths), "建設完成");
  const completedDemand = getDemand(tile, tile.building);
  const completedRooms = createRooms(tile.building, completedDemand, nextProcessingMonth);
return {
  ...tile,
  rooms: completedRooms,
  buildingStatus: "active",
  leaseCycleStartMonth: nextProcessingMonth,
  buildRemaining: 0,
  buildStandardMonths: 0,
  buildActualMonths: 0,
  buildStandardCost: 0,
  buildActualCost: 0,
  buildEmployeeNames: [],
  buildEmployeeIds: [],
};
  }

  eventLog.push(`${building.name} 建設中 残り${remain}ヶ月`);

return {
  ...tile,
  buildRemaining: remain,
  rooms: [],
};
}
const occupiedCount = tile.rooms.filter((r) => r.occupied).length;

const vacancyRate =
  tile.rooms.length > 0
    ? 1 - occupiedCount / tile.rooms.length
    : 0;

let vacancyMonths = tile.vacancyMonths ?? 0;
let recoveryMode = tile.recoveryMode ?? false;

if ((tile.condition ?? 100) < 50 && vacancyRate >= 0.5) {
  vacancyMonths++;
} else {
  vacancyMonths = 0;
}
if (
  recoveryMode &&
  vacancyRate <= 0.2
) {
  recoveryMode = false;

  eventLog.push(
    `${building.name}は空室改善により通常募集へ戻しました`
  );
}
if (vacancyMonths >= 24 && !recoveryMode) {

  const currentAverageRent =
    tile.rooms.length > 0
      ? Math.round(
          tile.rooms.reduce((sum, r) => sum + r.rent, 0) /
            tile.rooms.length
        )
      : building.baseRent;

  const discountedRent = Math.max(
    3,
    Math.round(currentAverageRent * 0.7)
  );

  const ok = window.confirm(
    `${building.name}で長期空室が続いています。\n\n` +

      `建物状態: ${Math.round(tile.condition ?? 100)}%\n` +
      `空室率: ${Math.round(vacancyRate * 100)}%\n\n` +

      `現在平均家賃: ${currentAverageRent}万円\n` +
      `値下げ後家賃: ${discountedRent}万円\n\n` +

      `賃料を30%値下げして、入居率上昇を試みますか？`
  );

  if (ok) {
    recoveryMode = true;
    eventLog.push(`${building.name}は大幅値下げ募集を開始しました`);
  } else {
    vacancyMonths = 0;
    eventLog.push(`${building.name}の大幅値下げ募集は見送りました`);
  }
}

// v85：入居・退去・家賃更新は、建物ごとの3ヶ月周期で分散判定する。
// 家賃収入は毎月発生するが、入居中の家賃は契約家賃として固定し、24ヶ月ごとの更新時だけ見直す。
const buildingLeaseBaseMonth =
  tile.leaseCycleStartMonth ??
  tile.buildCompletedMonth ??
  tile.buildStartMonth ??
  tile.id % 3;

const shouldRunQuarterlyBuildingCheck =
  ((nextProcessingMonth - buildingLeaseBaseMonth) % 3 + 3) % 3 === 0;

const normalizeContractRoom = (room) => {
  const currentRent = Number.isFinite(room.rent) ? room.rent : building.baseRent;
  const tenantMonths = room.tenantMonths ?? 0;

  if (!room.occupied) {
    return {
      ...room,
      rent: currentRent,
      contractRent: null,
      contractStartMonth: null,
      lastRentReviewMonth: null,
      tenantMonths,
    };
  }

  const estimatedContractStartMonth = Math.max(0, nextProcessingMonth - tenantMonths);

  return {
    ...room,
    rent: currentRent,
    contractRent: room.contractRent ?? currentRent,
    contractStartMonth: room.contractStartMonth ?? estimatedContractStartMonth,
    lastRentReviewMonth:
      room.lastRentReviewMonth ??
      Math.max(0, nextProcessingMonth - (tenantMonths % 24)),
    tenantMonths,
  };
};

const normalizedRooms = tile.rooms.map(normalizeContractRoom);

const newRooms = normalizedRooms.map((room) => {
  if (!shouldRunQuarterlyBuildingCheck) {
    if (room.occupied) {
      income += room.rent;
      return {
        ...room,
        tenantMonths: (room.tenantMonths ?? 0) + 1,
      };
    }

    return room;
  }

if (!room.occupied) {
  const tenantKey =
    building.allowedTenants[
      randomInt(0, building.allowedTenants.length - 1)
    ];

  const rentDemandPenalty = getRentDemandPenalty(
    tile,
    tile.building,
    tenantKey
  );

 const recoveryBonus = recoveryMode ? 1.5 : 1.0;

if (
  Math.random() * 100 <
  demand * 0.7 * rentDemandPenalty * recoveryBonus
) {
    const tenant = TENANT_TYPES[tenantKey];

    const people = randomInt(
      tenant.peopleMin,
      tenant.peopleMax
    );

const rent = calculateNewRent(
  tile,
  tile.building,
  tenantKey
);

let adjustedRent = rent;

if (recoveryMode) {
  adjustedRent = Math.max(3, Math.round(rent * 0.7));
}

    eventLog.push(
      `${building.name}の${room.roomNo}号室に${tenant.name}が入居`
    );

    income += adjustedRent;

return {
  ...room,
  tenantType: tenantKey,
  people,
  rent: adjustedRent,
  contractRent: adjustedRent,
  contractStartMonth: nextProcessingMonth,
  lastRentReviewMonth: nextProcessingMonth,
  occupied: true,
  tenantMonths: 0,
};
  }

  return room;
}

        let vacancyRisk = Math.max(0.4, 6 - demand / 18);

// 建物状態が悪いと退去率上昇
if ((tile.condition ?? 100) < 70) {
  vacancyRisk += (70 - (tile.condition ?? 100)) / 20;
}

// 築古ほど少し退去率上昇
if ((tile.age ?? 0) > 20) {
  vacancyRisk += Math.min(2, ((tile.age ?? 0) - 20) / 10);
}

        if (Math.random() * 100 < vacancyRisk) {
          eventLog.push(`${building.name}の${room.roomNo}号室が退去`);

         return {
  ...room,
  tenantType: null,
  people: 0,
  rent: building.baseRent,
  contractRent: null,
  contractStartMonth: null,
  lastRentReviewMonth: null,
  occupied: false,
  tenantMonths: 0,
};
        }

const tenantMonths = (room.tenantMonths ?? 0) + 1;
let reviewedRent = room.rent;
let lastRentReviewMonth = room.lastRentReviewMonth ?? room.contractStartMonth ?? nextProcessingMonth;

if (tenantMonths > 0 && tenantMonths % 24 === 0) {
  const marketRent = calculateNewRent(
    tile,
    tile.building,
    room.tenantType
  );

  const rentGap = marketRent - room.rent;

  if (Math.abs(rentGap) >= 1) {
    const adjustmentRate = rentGap > 0 ? 0.35 : 0.25;
    reviewedRent = Math.max(
      3,
      Math.round(room.rent + rentGap * adjustmentRate)
    );
    lastRentReviewMonth = nextProcessingMonth;

    if (reviewedRent !== room.rent) {
      eventLog.push(
        `${building.name}の${room.roomNo}号室で契約更新があり、家賃を${room.rent}万円 → ${reviewedRent}万円に見直しました`
      );
    }
  }
}

income += reviewedRent;

return {
  ...room,
  rent: reviewedRent,
  contractRent: reviewedRent,
  lastRentReviewMonth,
  tenantMonths,
};
      });
// 駅・学校・道路周辺は地価が上がりやすい
let landPriceChange = 0;

const stationDistance = getDistance(
  tile.x,
  tile.y,
  stationPos.x,
  stationPos.y
);

const schoolDistance = getDistance(
  tile.x,
  tile.y,
  schoolPos.x,
  schoolPos.y
);

const roadNearby = hasRoadNearForNextMonth(tile.x, tile.y);

if (stationDistance <= 3) landPriceChange += 3;
if (schoolDistance <= 4) landPriceChange += 2;
if (roadNearby) landPriceChange += 1;

// 周辺に建物が増えると地価が上がりやすい
const nearbyBuildings = countNearbyMainBuildingsForNextMonth(tile.x, tile.y, 3);

if (nearbyBuildings >= 3) landPriceChange += 1;
if (nearbyBuildings >= 6) landPriceChange += 2;
if (nearbyBuildings >= 10) landPriceChange += 3;

// 海・川近くはリスクで上がりにくい
if (tile.terrain === TERRAIN.RIVER || tile.terrain === TERRAIN.SEA) {
  landPriceChange -= 2;
}

if (landPriceChange !== 0 && Math.random() < 0.15) {
  return {
    ...tile,
    rooms: newRooms,
    landPrice: Math.max(100, tile.landPrice + landPriceChange),
    age: tile.age + 1 / 12,

    condition: Math.max(
      30,
      tile.condition - (shouldRunQuarterlyBuildingCheck ? randomInt(0, 2) * 0.3 : 0)
    ),
  };
}

return {
  ...tile,
  rooms: newRooms,

  age: tile.age + 1 / 12,

  condition: Math.max(
    30,
    tile.condition - (shouldRunQuarterlyBuildingCheck ? randomInt(0, 2) * 0.3 : 0)
  ),
};
});
const completedStationProjects = [];

newStationProjects = newStationProjects
  .map((project) => ({
    ...project,
    monthsLeft: project.monthsLeft - 1,
  }))
  .filter((project) => {
    if (project.monthsLeft > 0) {
      return true;
    }

    completedStationProjects.push(project);

    eventLog.push(
      `新駅が完成しました (${project.x},${project.y})`
    );

    return false;
  });

const stationCompletedTiles = updatedTiles.map((tile) => {
  const project = completedStationProjects.find(
    (p) => p.x === tile.x && p.y === tile.y
  );

  if (!project) return tile;

  return {
    ...tile,
    terrain: TERRAIN.PLAIN,
    feature: FEATURE.STATION,
    rail: true,
    owner: OWNER.PUBLIC,
    building: null,
    buildingMainId: null,
    rooms: [],
  };
});

const rezonedTiles = stationCompletedTiles.map((tile) => {
  const completedStation = completedStationProjects.find(
    (p) => getDistance(tile.x, tile.y, p.x, p.y) <= 3
  );

  if (!completedStation) {
    return tile;
  }

  const distance = getDistance(
    tile.x,
    tile.y,
    completedStation.x,
    completedStation.y
  );

  // 学校近辺は住宅維持
  const schoolNearby =
    getDistance(
      tile.x,
      tile.y,
      schoolPos.x,
      schoolPos.y
    ) <= 3;

  if (schoolNearby) {
    return {
      ...tile,
      zone: ZONE.RESIDENTIAL,
      landPrice: tile.landPrice + Math.max(0, 2000 - distance * 400),
    };
  }

  return {
    ...tile,
    zone: ZONE.COMMERCIAL,
    landPrice: tile.landPrice + Math.max(0, 2000 - distance * 400),
  };
});

const cityChangedTiles = rezonedTiles.map((tile) => {
  // 自分の土地や公共地は勝手に変えない
  if (tile.owner === OWNER.PLAYER || tile.owner === OWNER.PUBLIC) {
    return tile;
  }
/// 売り物件が他人に買われる
if (tile.owner === OWNER.SALE) {
  if (Math.random() < 0.015) {
    eventLog.push(
      `${tile.building ? BUILDINGS[tile.building].name : "売り土地"}が他人に買われました`
    );

    return {
      ...tile,
      owner: OWNER.OTHER,
    };
  }
}
  // 他人の空地に、低確率で建物が建つ
if (tile.owner === OWNER.OTHER && !tile.building && isBuildableTile(tile)) {
  // v82軽量化：NPCの自然建築は最大でも月1%未満の低確率。
  // 先に乱数で候補を絞り、候補になった土地だけ需要計算する。
  // これにより通常の翌月処理で全空地に住宅/商業/工業需要計算を走らせない。
  const npcGrowthRoll = Math.random();

  if (npcGrowthRoll >= 0.01) {
    return tile;
  }

  const housingScore = getHousingDemandScore(tile);
const commercialScore = getCommercialDemandScore(tile, tiles);
const industrialScore = getIndustrialDemandScore(tile);

const maxDemand = Math.max(
  housingScore,
  commercialScore,
  industrialScore
);

const growthChance =
  0.001 +
  Math.max(0, maxDemand - 50) / 12000;

if (npcGrowthRoll < growthChance) {
const buildingKey = selectNPCBuildingByDemand(tile);
    const placement = canPlaceNPCBuilding(tile, buildingKey, updatedTiles);

    if (!placement.ok) {
      return tile;
    }

    const demand = getDemand(tile, buildingKey);

    eventLog.push(
      `町に${BUILDINGS[buildingKey].name}が建ちました`
    );

    return {
      ...tile,
      building: buildingKey,
      buildingMainId: null,
      rooms: createRooms(buildingKey, demand, nextProcessingMonth),
      buildingStatus: "active",
      leaseCycleStartMonth: nextProcessingMonth,
      buildRemaining: 0,
      age: 0,
      condition: 100,
      npcPlacementWidth: placement.width,
      npcPlacementHeight: placement.height,
    };
  }
}
// 古くなった他人物件は、売却・取り壊しされることがある
if (tile.owner === OWNER.OTHER && tile.building && !tile.buildingMainId) {
  const oldAction = getOldBuildingActionChance(tile);

  if (oldAction) {
    if (Math.random() < oldAction.demolishChance) {
      eventLog.push(
        `築古の${BUILDINGS[tile.building].name}が取り壊され、更地になりました`
      );

      return {
        ...tile,
        building: null,
        buildingMainId: null,
        rooms: [],
        buildingStatus: null,
        buildRemaining: 0,
        age: 0,
        condition: 100,
      };
    }

    if (Math.random() < oldAction.sellChance) {
      eventLog.push(
        `築古の${BUILDINGS[tile.building].name}が売りに出ました`
      );

      return {
        ...tile,
        owner: OWNER.SALE,
      };
    }
  }
}
  // 他人の建物がたまに売りに出る
  if (tile.owner === OWNER.OTHER && tile.building && !tile.buildingMainId) {
    if (Math.random() < 0.003) {
      eventLog.push(`${BUILDINGS[tile.building].name}が売りに出ました`);

      return {
        ...tile,
        owner: OWNER.SALE,
      };
    }
  }

  // 他人の空地が売りに出る
// 他人の既存建物が少しずつ発展する
if (tile.owner === OWNER.OTHER && tile.building && !tile.buildingMainId) {
  const current = tile.building;

  let nextBuilding = null;

  if (current === "house_1f") {
    nextBuilding = "house_2f";
  }

  if (current === "house_2f" && Math.random() < 0.5) {
    nextBuilding = "apt_2f_family";
  }

  if (current === "apt_2f_single" && Math.random() < 0.4) {
    nextBuilding = "apt_3f_single";
  }

  if (current === "apt_2f_family" && Math.random() < 0.3) {
    nextBuilding = "mansion_5f";
  }

  if (current === "restaurant" && Math.random() < 0.4) {
  nextBuilding = "convenience";
}

if (current === "convenience" && Math.random() < 0.35) {
  nextBuilding = "drugstore";
}

if (current === "drugstore" && Math.random() < 0.25) {
  nextBuilding = "supermarket";
}

if (current === "supermarket" && Math.random() < 0.15) {
  nextBuilding = "commercial_big";
}

  let growthChance = 0.02;

const stationDistance = getDistance(
  tile.x,
  tile.y,
  stationPos.x,
  stationPos.y
);

if (stationDistance <= 3) {
    if (
      nextBuilding === "convenience" ||
      nextBuilding === "apt_2f_single" ||
      nextBuilding === "apt_3f_single" ||
      nextBuilding === "mansion_5f"
    ) {
      growthChance += 0.2;
    }
  }

  const schoolDistance = getDistance(tile.x, tile.y, 8, 8);

  if (schoolDistance <= 4) {
    if (
      nextBuilding === "house_2f" ||
      nextBuilding === "apt_2f_family"
    ) {
      growthChance += 0.15;
    }

    if (nextBuilding === "small_shop") {
      growthChance += 0.15;
    }
  }

  const roadNearby = hasRoadNearForNextMonth(tile.x, tile.y);

  if (roadNearby) {
    if (
      nextBuilding === "small_shop" ||
      nextBuilding === "convenience"
    ) {
      growthChance += 0.15;
    }
  }

  if (nextBuilding && Math.random() < growthChance) {
    const placement = canPlaceNPCRebuild(tile, nextBuilding, updatedTiles);

    if (!placement.ok) {
      return tile;
    }

    const demand = getDemand(tile, nextBuilding);

    eventLog.push(
      `町の${BUILDINGS[current].name}が${BUILDINGS[nextBuilding].name}に建て替わりました`
    );

    return {
      ...tile,
      building: nextBuilding,
      buildingMainId: null,
      rooms: createRooms(nextBuilding, demand, nextProcessingMonth),
      buildingStatus: "active",
      leaseCycleStartMonth: nextProcessingMonth,
      buildRemaining: 0,
      age: 0,
      condition: 100,
      npcPlacementWidth: placement.width,
      npcPlacementHeight: placement.height,
    };
  }
}

  return tile;
});

function getExistingRivalCompanyIds(tileList) {
  return Object.keys(RIVAL_COMPANIES).filter((companyId) => {
    return tileList.some((tile) => {
      return tile.owner === OWNER.RIVAL &&
        tile.rivalCompanyId === companyId &&
        tile.feature === FEATURE.HQ;
    });
  });
}

function pickUnusedRivalCompanyName(tileList) {
  const usedNames = new Set(
    tileList
      .filter((tile) => tile.owner === OWNER.RIVAL && tile.rivalCompanyName)
      .map((tile) => tile.rivalCompanyName)
  );

  const unusedNames = RIVAL_COMPANY_NAME_CANDIDATES.filter((name) => !usedNames.has(name));
  const candidateNames = unusedNames.length > 0 ? unusedNames : RIVAL_COMPANY_NAME_CANDIDATES;
  return candidateNames[randomInt(0, candidateNames.length - 1)] ?? getRivalCompany(LATE_RIVAL_COMPANY_ID).name;
}

function createLateRivalCompanyEntry(tileList, companyId = LATE_RIVAL_COMPANY_ID) {
  const company = getRivalCompany(companyId);
  const alreadyExists = tileList.some((tile) => {
    return tile.owner === OWNER.RIVAL &&
      tile.rivalCompanyId === companyId &&
      tile.feature === FEATURE.HQ;
  });

  if (alreadyExists) {
    return { tiles: tileList, log: null, placed: false };
  }

  const existingHqTiles = tileList.filter((tile) => {
    return tile.owner === OWNER.RIVAL && tile.feature === FEATURE.HQ;
  });

  const getCandidates = (minDistanceFromRivals, requireRoadOrRail) => {
    return tileList.filter((tile) => {
      if (tile.terrain !== TERRAIN.PLAIN) return false;
      if (tile.feature !== FEATURE.NONE) return false;
      if (tile.building || tile.buildingMainId) return false;
      if (tile.owner === OWNER.PLAYER || tile.owner === OWNER.PUBLIC || tile.owner === OWNER.RIVAL) return false;
      if (requireRoadOrRail && !isTileNearRoadOrRail(tile, tileList)) return false;

      return existingHqTiles.every((hqTile) => {
        return getDistance(tile.x, tile.y, hqTile.x, hqTile.y) >= minDistanceFromRivals;
      });
    });
  };

  const candidatePool = getCandidates(15, true).length > 0
    ? getCandidates(15, true)
    : getCandidates(10, true).length > 0
      ? getCandidates(10, true)
      : getCandidates(15, false);

  if (candidatePool.length === 0) {
    return { tiles: tileList, log: null, placed: false };
  }

  const targetTile = candidatePool[randomInt(0, candidatePool.length - 1)];
  const companyName = pickUnusedRivalCompanyName(tileList);
  const rivalEmployees = Array.from({ length: 4 }, () => {
    return {
      ...pickRivalInitialEmployee(),
      officeId: `rival_${company.id}_hq`,
    };
  });

  const nextTiles = tileList.map((tile) => {
    if (tile.id !== targetTile.id) return tile;

    return {
      ...tile,
      owner: OWNER.RIVAL,
      feature: FEATURE.HQ,
      building: null,
      buildingMainId: null,
      rooms: [],
      rivalCompanyId: company.id,
      rivalCompanyName: companyName,
      rivalOfficeName: `${companyName} 本社`,
      rivalEmployees,
      rivalMoney: company.initialMoney,
      rivalAgeMonths: 0,
      rivalSixMonthTicketGranted: true,
      rivalRank: 10,
    };
  });

  return {
    tiles: nextTiles,
    placed: true,
    log: `【経済ニュース】大手不動産会社「${companyName}」が参入しました。初期資金12億円・社員4名で本社を設立しました。`,
  };
}

function runRivalCompanyMonthlyAction(tileList, companyId) {
  const companyBase = getRivalCompany(companyId);
  let nextTiles = tileList;
  const companyTiles = nextTiles.filter((tile) => tile.owner === OWNER.RIVAL && tile.rivalCompanyId === companyId);
  const officeTilesForCompany = companyTiles.filter((tile) => tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH);

  if (officeTilesForCompany.length === 0) {
    return { tiles: nextTiles, logs: [] };
  }

  const logs = [];
  const hqTileForCompany = officeTilesForCompany.find((tile) => tile.feature === FEATURE.HQ) ?? officeTilesForCompany[0];
  const company = {
    ...companyBase,
    name: hqTileForCompany?.rivalCompanyName ?? companyBase.name,
  };
  let rivalMoney = hqTileForCompany?.rivalMoney ?? company.initialMoney ?? 10000;

  const rivalMainBuildings = companyTiles.filter((tile) => {
    return tile.building && !tile.buildingMainId && tile.feature !== FEATURE.HQ && tile.feature !== FEATURE.BRANCH;
  });
  const rivalMonthlyRent = rivalMainBuildings.reduce((sum, tile) => {
    return sum + (tile.rooms ?? []).reduce((roomSum, room) => {
      return roomSum + (room.occupied ? (room.rent ?? 0) : 0);
    }, 0);
  }, 0);
  const rivalMonthlyMaintenance = rivalMainBuildings.reduce((sum, tile) => {
    return sum + calculateMonthlyExpenses(tile);
  }, 0);
  const rivalMonthlyPayroll = (hqTileForCompany?.rivalEmployees ?? []).reduce((sum, employee) => {
    return sum + (employee.salary ?? 0);
  }, 0);
  const rivalMonthlyNet = rivalMonthlyRent - rivalMonthlyMaintenance - rivalMonthlyPayroll;
  rivalMoney = Math.max(0, Math.round(rivalMoney + rivalMonthlyNet));

  if (gameDate.month === 6) {
    const rivalYearlyTax = companyTiles.reduce((sum, tile) => {
      if (tile.buildingMainId) return sum;
      if (tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH || tile.building) {
        return sum + calculateCompanyYearlyPropertyTax(tile);
      }
      return sum;
    }, 0);

    if (rivalYearlyTax > 0) {
      rivalMoney = Math.max(0, Math.round(rivalMoney - rivalYearlyTax));
      logs.push(`${company.name}が固定資産税${rivalYearlyTax}万円を支払いました。`);
    }
  }

  const updateRivalMoney = (tileListForMoney, nextMoney) => {
    return tileListForMoney.map((tile) => {
      if (tile.id !== hqTileForCompany?.id) return tile;
      return {
        ...tile,
        rivalMoney: nextMoney,
      };
    });
  };

  const updateRivalHq = (tileListForHq, patch) => {
    return tileListForHq.map((tile) => {
      if (tile.id !== hqTileForCompany?.id) return tile;
      return {
        ...tile,
        ...patch,
      };
    });
  };

  const nextRivalAgeMonths = (hqTileForCompany?.rivalAgeMonths ?? 0) + 1;
  let rivalEmployees = Array.isArray(hqTileForCompany?.rivalEmployees)
    ? [...hqTileForCompany.rivalEmployees]
    : [];

  const alreadyGrantedSixMonthTicket = hqTileForCompany?.rivalSixMonthTicketGranted === true;
  let nextRivalSixMonthTicketGranted = alreadyGrantedSixMonthTicket;

  if (!alreadyGrantedSixMonthTicket && nextRivalAgeMonths >= 6 && rivalEmployees.length < 4) {
    const newEmployee = pickRivalInitialEmployee();
    rivalEmployees.push({
      ...newEmployee,
      officeId: `${companyId}_hq`,
    });
    nextRivalSixMonthTicketGranted = true;
    logs.push(`${company.name}が設立6ヶ月の社員チケットを使用し、${newEmployee.name}（${newEmployee.rarity}）を採用しました。`);
  }

  const previousRivalRank = Math.max(1, hqTileForCompany?.rivalRank ?? 1);
  const nextRivalRank = Math.max(
    previousRivalRank,
    Math.max(1, Math.floor(nextRivalAgeMonths / 12) + 1)
  );

  if (nextRivalRank > previousRivalRank) {
    const rankUpCount = nextRivalRank - previousRivalRank;

    for (let i = 0; i < rankUpCount; i += 1) {
      const newEmployee = pickRivalInitialEmployee();
      rivalEmployees.push({
        ...newEmployee,
        officeId: `rival_${companyId}_hq`,
      });
      logs.push(`${company.name}がランク${previousRivalRank + i + 1}到達の社員チケットを使用し、${newEmployee.name}（${newEmployee.rarity}）を採用しました。`);
    }
  }

  nextTiles = updateRivalHq(nextTiles, {
    rivalAgeMonths: nextRivalAgeMonths,
    rivalEmployees,
    rivalSixMonthTicketGranted: nextRivalSixMonthTicketGranted,
    rivalRank: nextRivalRank,
  });

  const refreshCurrentRivalOfficeTiles = () => {
    return nextTiles.filter((tile) => {
      return tile.owner === OWNER.RIVAL &&
        tile.rivalCompanyId === companyId &&
        (tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH);
    });
  };

  const getOfficeIdForRivalOfficeTile = (officeTile) => {
    if (!officeTile) return `rival_${companyId}_hq`;
    if (officeTile.rivalOfficeId) return officeTile.rivalOfficeId;
    if (officeTile.officeId) return officeTile.officeId;
    return officeTile.feature === FEATURE.HQ ? `rival_${companyId}_hq` : `rival_${companyId}_branch_${officeTile.branchNumber ?? 1}`;
  };

  const redistributeRivalEmployeesAcrossOffices = (employeeList, officeTileList) => {
    const sortedOfficeTiles = [...officeTileList].sort((a, b) => {
      if (a.feature === FEATURE.HQ && b.feature !== FEATURE.HQ) return -1;
      if (a.feature !== FEATURE.HQ && b.feature === FEATURE.HQ) return 1;
      return (a.branchNumber ?? 0) - (b.branchNumber ?? 0);
    });

    if (sortedOfficeTiles.length === 0) return employeeList;

    const officeIds = sortedOfficeTiles.map(getOfficeIdForRivalOfficeTile);
    const officeCounts = new Map(officeIds.map((officeId) => [officeId, 0]));

    return employeeList.map((employee, index) => {
      let targetOfficeId = employee.officeId;

      if (!officeIds.includes(targetOfficeId) || (officeCounts.get(targetOfficeId) ?? 0) >= MAX_EMPLOYEES_PER_OFFICE) {
        targetOfficeId = officeIds.find((officeId) => (officeCounts.get(officeId) ?? 0) < MAX_EMPLOYEES_PER_OFFICE) ?? officeIds[index % officeIds.length];
      }

      officeCounts.set(targetOfficeId, (officeCounts.get(targetOfficeId) ?? 0) + 1);

      return {
        ...employee,
        officeId: targetOfficeId,
      };
    });
  };

  let currentRivalOfficeTiles = refreshCurrentRivalOfficeTiles();
  rivalEmployees = redistributeRivalEmployeesAcrossOffices(rivalEmployees, currentRivalOfficeTiles);
  nextTiles = updateRivalHq(nextTiles, { rivalEmployees });

  const isInCompanyRange = (tile) => {
    return refreshCurrentRivalOfficeTiles().some((officeTile) => {
      const range = getOfficeActionRange(officeTile);
      return getDistance(tile.x, tile.y, officeTile.x, officeTile.y) <= range;
    });
  };

  const currentRivalBranchCount = currentRivalOfficeTiles.filter((tile) => tile.feature === FEATURE.BRANCH).length;
  const targetRivalBranchCount = Math.floor(rivalEmployees.length / 5);

  if (currentRivalBranchCount < targetRivalBranchCount) {
    if (rivalMoney < BRANCH_OFFICE_COST) {
      const branchShortfall = BRANCH_OFFICE_COST - rivalMoney;
      const branchFinancingAmount = Math.min(50000, Math.max(5000, Math.ceil(branchShortfall / 1000) * 1000));
      rivalMoney += branchFinancingAmount;
      logs.push(`${company.name}が支店開設資金として${branchFinancingAmount}万円を調達しました。`);
    }

    if (rivalMoney >= BRANCH_OFFICE_COST) {
    let branchCandidates = nextTiles.filter((tile) => {
      if (tile.terrain !== TERRAIN.PLAIN) return false;
      if (tile.feature !== FEATURE.NONE) return false;
      if (tile.building || tile.buildingMainId) return false;
      if (tile.owner === OWNER.PLAYER || tile.owner === OWNER.PUBLIC || tile.owner === OWNER.RIVAL) return false;
      if (!isTileNearRoadOrRail(tile, nextTiles)) return false;
      if (!isInCompanyRange(tile)) return false;

      return currentRivalOfficeTiles.every((officeTile) => {
        return getDistance(tile.x, tile.y, officeTile.x, officeTile.y) >= OFFICE_MIN_DISTANCE;
      });
    });

    if (branchCandidates.length === 0) {
      branchCandidates = nextTiles.filter((tile) => {
        if (tile.terrain !== TERRAIN.PLAIN) return false;
        if (tile.feature !== FEATURE.NONE) return false;
        if (tile.building || tile.buildingMainId) return false;
        if (tile.owner === OWNER.PLAYER || tile.owner === OWNER.PUBLIC || tile.owner === OWNER.RIVAL) return false;

        const nearestOfficeDistance = currentRivalOfficeTiles.reduce((minDistance, officeTile) => {
          return Math.min(minDistance, getDistance(tile.x, tile.y, officeTile.x, officeTile.y));
        }, 999);

        return nearestOfficeDistance <= BRANCH_ACTION_RANGE;
      });
    }

    if (branchCandidates.length === 0) {
      branchCandidates = nextTiles.filter((tile) => {
        if (tile.terrain !== TERRAIN.PLAIN) return false;
        if (tile.feature !== FEATURE.NONE) return false;
        if (tile.building || tile.buildingMainId) return false;
        if (tile.owner === OWNER.PLAYER || tile.owner === OWNER.PUBLIC || tile.owner === OWNER.RIVAL) return false;

        const nearestOfficeDistance = currentRivalOfficeTiles.reduce((minDistance, officeTile) => {
          return Math.min(minDistance, getDistance(tile.x, tile.y, officeTile.x, officeTile.y));
        }, 999);

        return nearestOfficeDistance <= BRANCH_ACTION_RANGE + 5;
      });
    }

    if (branchCandidates.length > 0) {
      const branchTarget = branchCandidates[randomInt(0, branchCandidates.length - 1)];
      const branchNumber = currentRivalBranchCount + 1;
      const branchOfficeId = `rival_${companyId}_branch_${branchNumber}`;
      rivalMoney -= BRANCH_OFFICE_COST;

      nextTiles = nextTiles.map((tile) => {
        if (tile.id !== branchTarget.id) return tile;
        return {
          ...tile,
          owner: OWNER.RIVAL,
          feature: FEATURE.BRANCH,
          building: null,
          buildingMainId: null,
          rooms: [],
          rivalCompanyId: companyId,
          rivalCompanyName: company.name,
          rivalOfficeId: branchOfficeId,
          officeId: branchOfficeId,
          rivalOfficeName: `${company.name} 支店${branchNumber}`,
          officeRange: BRANCH_ACTION_RANGE,
          branchNumber,
        };
      });

      currentRivalOfficeTiles = refreshCurrentRivalOfficeTiles();
      rivalEmployees = redistributeRivalEmployeesAcrossOffices(rivalEmployees, currentRivalOfficeTiles);
      const movedCount = rivalEmployees.filter((employee) => employee.officeId === branchOfficeId).length;

      nextTiles = updateRivalHq(nextTiles, {
        rivalMoney,
        rivalEmployees,
        rivalRank: nextRivalRank,
        rivalAgeMonths: nextRivalAgeMonths,
        rivalSixMonthTicketGranted: nextRivalSixMonthTicketGranted,
      });
      logs.push(`${company.name}が支店${branchNumber}を開設しました (${branchTarget.x},${branchTarget.y}) / 開設費${BRANCH_OFFICE_COST}万円 / 配属${movedCount}名`);
      return { tiles: nextTiles, logs };
    }
    }
  }

  const ownedEmptyTiles = nextTiles.filter((tile) => {
    return tile.owner === OWNER.RIVAL &&
      tile.rivalCompanyId === companyId &&
      !tile.building &&
      !tile.buildingMainId &&
      isBuildableTile(tile) &&
      isInCompanyRange(tile);
  });

  if (ownedEmptyTiles.length > 0 && Math.random() < 0.65) {
    const target = ownedEmptyTiles[randomInt(0, ownedEmptyTiles.length - 1)];
    let buildingKey = selectNPCBuildingByDemand(target);
    const rivalRank = nextRivalRank;
    if (!isBuildingUnlockedForRank(buildingKey, rivalRank)) {
      buildingKey = rivalRank >= 2 ? "house_3f" : "house_1f";
    }
    const placement = canPlaceCompanyBuilding(target, buildingKey, nextTiles, OWNER.RIVAL, companyId);

    if (placement.ok) {
      const buildingCost = BUILDINGS[buildingKey]?.cost ?? 0;
      if (rivalMoney < buildingCost) {
        const shortfall = buildingCost - rivalMoney;
        const financingAmount = Math.min(50000, Math.max(3000, Math.ceil(shortfall / 1000) * 1000));
        rivalMoney += financingAmount;
        logs.push(`${company.name}が金融機関から運転資金${financingAmount}万円を調達しました。`);
      }

      if (rivalMoney < buildingCost) {
        nextTiles = updateRivalMoney(nextTiles, rivalMoney);
        return { tiles: nextTiles, logs };
      }

      rivalMoney -= buildingCost;
      const demand = getDemand(target, buildingKey);
      nextTiles = nextTiles.map((tile) => {
        if (tile.id === target.id) {
          return {
            ...tile,
            owner: OWNER.RIVAL,
            rivalCompanyId: companyId,
            building: buildingKey,
            buildingMainId: null,
            rooms: createRooms(buildingKey, demand, nextProcessingMonth),
            buildingStatus: "active",
            leaseCycleStartMonth: nextProcessingMonth,
            buildRemaining: 0,
            age: 0,
            condition: 100,
            npcPlacementWidth: placement.width,
            npcPlacementHeight: placement.height,
          };
        }

        const inArea =
          tile.x >= target.x &&
          tile.x < target.x + placement.width &&
          tile.y >= target.y &&
          tile.y < target.y + placement.height;

        if (!inArea || tile.id === target.id) return tile;

        return {
          ...tile,
          owner: OWNER.RIVAL,
          rivalCompanyId: companyId,
          building: buildingKey,
          buildingMainId: target.id,
          rooms: [],
          buildingStatus: "active",
          buildRemaining: 0,
          age: 0,
          condition: 100,
        };
      });

      nextTiles = updateRivalMoney(nextTiles, rivalMoney);

      logs.push(`${company.name}が${BUILDINGS[buildingKey].name}を建設しました (${target.x},${target.y}) / 建設費${buildingCost}万円 / 残資金${rivalMoney}万円`);
      return { tiles: nextTiles, logs };
    }
  }

  const purchaseCandidates = nextTiles.filter((tile) => {
    return tile.terrain === TERRAIN.PLAIN &&
      tile.feature === FEATURE.NONE &&
      !tile.building &&
      !tile.buildingMainId &&
      tile.owner !== OWNER.PLAYER &&
      tile.owner !== OWNER.PUBLIC &&
      tile.owner !== OWNER.RIVAL &&
      isInCompanyRange(tile);
  });

  if (purchaseCandidates.length > 0 && Math.random() < 0.8) {
    const affordableCandidates = purchaseCandidates.filter((tile) => {
      return (tile.landPrice ?? 0) <= rivalMoney;
    });

    if (affordableCandidates.length === 0) {
      const lowestPrice = Math.min(...purchaseCandidates.map((tile) => tile.landPrice ?? 0));
      if (Number.isFinite(lowestPrice) && lowestPrice > 0) {
        const shortfall = lowestPrice - rivalMoney;
        const financingAmount = Math.min(30000, Math.max(2000, Math.ceil(shortfall / 1000) * 1000));
        rivalMoney += financingAmount;
        logs.push(`${company.name}が土地取得資金${financingAmount}万円を調達しました。`);
      }
    }

    const refreshedAffordableCandidates = purchaseCandidates.filter((tile) => {
      return (tile.landPrice ?? 0) <= rivalMoney;
    });

    if (refreshedAffordableCandidates.length === 0) {
      nextTiles = updateRivalMoney(nextTiles, rivalMoney);
      return { tiles: nextTiles, logs };
    }

    const target = refreshedAffordableCandidates[randomInt(0, refreshedAffordableCandidates.length - 1)];
    const purchasePrice = target.landPrice ?? 0;
    rivalMoney -= purchasePrice;

    nextTiles = nextTiles.map((tile) => {
      if (tile.id !== target.id) return tile;
      return {
        ...tile,
        owner: OWNER.RIVAL,
        rivalCompanyId: companyId,
      };
    });

    nextTiles = updateRivalMoney(nextTiles, rivalMoney);

    logs.push(`${company.name}が土地を購入しました (${target.x},${target.y}) / 購入額${purchasePrice}万円 / 残資金${rivalMoney}万円`);
  }

  return { tiles: nextTiles, logs };
}

let rivalBaseTiles = cityChangedTiles;
const existingRivalCompanyIdsBeforeLateEntry = getExistingRivalCompanyIds(rivalBaseTiles);
const nextProcessingYear = Math.floor((nextProcessingMonth - 1) / 12) + 1;

if (
  nextProcessingYear >= 10 &&
  existingRivalCompanyIdsBeforeLateEntry.length < MAX_RIVAL_COMPANY_COUNT &&
  !existingRivalCompanyIdsBeforeLateEntry.includes(LATE_RIVAL_COMPANY_ID)
) {
  const lateEntryChance = Math.min(0.5, 0.2 + (nextProcessingYear - 10) * 0.05);

  if (Math.random() < lateEntryChance) {
    const lateEntryResult = createLateRivalCompanyEntry(rivalBaseTiles, LATE_RIVAL_COMPANY_ID);
    rivalBaseTiles = lateEntryResult.tiles;

    if (lateEntryResult.log) {
      eventLog.push(lateEntryResult.log);
    }
  }
}

let rivalActionTiles = rivalBaseTiles;
getExistingRivalCompanyIds(rivalActionTiles).forEach((companyId) => {
  const rivalActionResult = runRivalCompanyMonthlyAction(rivalActionTiles, companyId);
  rivalActionTiles = rivalActionResult.tiles;
  eventLog.push(...rivalActionResult.logs);
});

// v82軽量化：NPC複数マス建物の同期は、全タイルfindではなく座標Mapで1回だけ展開する。
const npcMainTileByCoordinate = new Map();
rivalActionTiles.forEach((mainTile) => {
  if (mainTile.owner !== OWNER.OTHER && mainTile.owner !== OWNER.SALE && mainTile.owner !== OWNER.RIVAL) return;
  if (!mainTile.building) return;
  if (mainTile.buildingMainId) return;
  if (!mainTile.npcPlacementWidth || !mainTile.npcPlacementHeight) return;

  for (let dy = 0; dy < mainTile.npcPlacementHeight; dy++) {
    for (let dx = 0; dx < mainTile.npcPlacementWidth; dx++) {
      if (dx === 0 && dy === 0) continue;
      npcMainTileByCoordinate.set(`${mainTile.x + dx},${mainTile.y + dy}`, mainTile);
    }
  }
});

const npcExpandedTiles = rivalActionTiles.map((tile) => {
  const mainTile = npcMainTileByCoordinate.get(`${tile.x},${tile.y}`);

  if (!mainTile) {
    return tile;
  }

  return {
    ...tile,
    owner: mainTile.owner,
    rivalCompanyId: mainTile.rivalCompanyId,
    building: mainTile.building,
    buildingMainId: mainTile.id,
    rooms: [],
    buildingStatus: mainTile.buildingStatus,
    buildRemaining: mainTile.buildRemaining,
    age: mainTile.age,
    condition: mainTile.condition,
    recoveryMode: mainTile.recoveryMode ?? false,
    vacancyMonths: mainTile.vacancyMonths ?? 0,
    leaseCycleStartMonth: mainTile.leaseCycleStartMonth ?? 0,
  };
});
    let taxPayment = 0;

if (gameDate.month === 6) {
  taxPayment = yearlyTax;

  eventLog.push(
    `固定資産税 ${yearlyTax}万円を支払いました`
  );
}

const monthlyEmployeeSalary = employees.reduce((sum, employee) => {
  return sum + (employee.salary ?? 0);
}, 0);

if (monthlyEmployeeSalary > 0) {
  maintenance += monthlyEmployeeSalary;
  eventLog.push(`社員給与 ${monthlyEmployeeSalary}万円を支払いました`);
}

let loanPaymentTotal = 0;
let nextLoans = loans.map((loan) => {
  if ((loan.remaining ?? 0) <= 0 || (loan.monthsLeft ?? 0) <= 0) return null;

  const monthlyInterest = Math.ceil((loan.remaining ?? 0) * (loan.annualRate ?? 0) / 12);
  const scheduledPayment = Math.min(loan.monthlyPayment ?? 0, loan.remaining + monthlyInterest);
  const principalPayment = Math.max(0, scheduledPayment - monthlyInterest);
  const nextRemaining = Math.max(0, (loan.remaining ?? 0) - principalPayment);
  const nextMonthsLeft = Math.max(0, (loan.monthsLeft ?? 0) - 1);

  loanPaymentTotal += scheduledPayment;

  if (nextRemaining <= 0 || nextMonthsLeft <= 0) {
    eventLog.push(`${loan.bankName}の借入を完済しました`);
    return null;
  }

  return {
    ...loan,
    remaining: nextRemaining,
    monthsLeft: nextMonthsLeft,
  };
}).filter(Boolean);

if (loanPaymentTotal > 0) {
  eventLog.push(`銀行返済 ${loanPaymentTotal.toLocaleString()}万円を支払いました`);
}

const net = income - maintenance - taxPayment - purchasePaymentTotal - loanPaymentTotal;
const updatedAnnualStats = {
  income: (annualStats.income ?? 0) + income,
  maintenance: (annualStats.maintenance ?? 0) + maintenance + loanPaymentTotal,
  tax: (annualStats.tax ?? 0) + taxPayment,
  purchase: (annualStats.purchase ?? 0) + purchasePaymentTotal,
  net: (annualStats.net ?? 0) + net,
};
newFactoryProjects = newFactoryProjects.map((project) => {
  const remain = project.monthsLeft - 1;

  if (remain <= 0) {
    eventLog.push(
      `新しい工場が完成しました (${project.x},${project.y})`
    );

    return {
      ...project,
      completed: true,
      monthsLeft: 0,
    };
  }

  return {
    ...project,
    monthsLeft: remain,
  };
});

const factoryCompleteTiles = npcExpandedTiles.map((tile) => {
  const project = newFactoryProjects.find(
    (p) =>
      p.completed &&
      Math.abs(tile.x - p.x) <= 1 &&
      Math.abs(tile.y - p.y) <= 1
  );

  if (!project) return tile;

  return {
    ...tile,
    terrain: TERRAIN.PLAIN,
    feature: FEATURE.FACTORY,
    owner: OWNER.PUBLIC,
    building: null,
    buildingMainId: null,
    rooms: [],
    zone: ZONE.INDUSTRIAL,
  };
});

newFactoryProjects = newFactoryProjects.filter((p) => !p.completed);

const mainTileByIdForSync = new Map(
  factoryCompleteTiles
    .filter((tile) => tile.building && !tile.buildingMainId)
    .map((tile) => [tile.id, tile])
);

const syncedTiles = factoryCompleteTiles.map((tile) => {
  let updatedTile = tile;

  if (tile.buildingMainId) {
    const mainTile = mainTileByIdForSync.get(tile.buildingMainId);

    if (mainTile) {
      updatedTile = {
        ...tile,
        buildingStatus: mainTile.buildingStatus,
        buildRemaining: mainTile.buildRemaining,
        age: mainTile.age,
        condition: mainTile.condition,
        leaseCycleStartMonth: mainTile.leaseCycleStartMonth ?? 0,
      };
    }
  }

  if (
    updatedTile.owner === OWNER.OTHER &&
    updatedTile.building &&
    !updatedTile.buildingMainId
  ) {
    return {
      ...updatedTile,
      age: (updatedTile.age ?? 0) + 1 / 12,
      condition: Math.max(
        30,
        (updatedTile.condition ?? 100) - randomInt(0, 2) * 0.2
      ),
    };
  }

  return updatedTile;
});

setTiles(syncedTiles);
setFactoryProjects(newFactoryProjects);
setStationProjects(newStationProjects);

const completedLoanConsultationEmployeeIds = [];
const completedLoanConsultationReports = [];
const nextPendingLoanConsultations = pendingLoanConsultations.map((consultation) => {
  const nextMonthsLeft = Math.max(0, (consultation.monthsLeft ?? 1) - 1);

  if (nextMonthsLeft > 0) {
    eventLog.push(`${consultation.bankName}の融資相談中：残り${nextMonthsLeft}ヶ月 / 担当:${consultation.employeeName || "-"}`);
    return {
      ...consultation,
      monthsLeft: nextMonthsLeft,
    };
  }

  const report = calculateLoanConsultationReport(consultation);
  completedLoanConsultationReports.push(report);
  if (consultation.employeeId != null) completedLoanConsultationEmployeeIds.push(consultation.employeeId);
  eventLog.push(`${consultation.bankName}の融資相談結果：推定${report.estimatedMin.toLocaleString()}万〜${report.estimatedMax.toLocaleString()}万円 / 担当:${consultation.employeeName || "-"}`);
  return null;
}).filter(Boolean);

let loanApprovalTotal = 0;
const completedLoanEmployeeIds = [];
let reviewedLoans = nextLoans;
const nextPendingLoanApplications = pendingLoanApplications.map((application) => {
  const nextMonthsLeft = Math.max(0, (application.monthsLeft ?? 1) - 1);

  if (nextMonthsLeft > 0) {
    eventLog.push(`${application.bankName}の融資審査中：残り${nextMonthsLeft}ヶ月 / 希望額${(application.requestedAmount ?? 0).toLocaleString()}万円`);
    return {
      ...application,
      monthsLeft: nextMonthsLeft,
    };
  }

  const result = calculateLoanReviewResult(application, reviewedLoans);
  completedLoanEmployeeIds.push(...(application.employeeIds ?? []));

  if (!result.approved) {
    eventLog.push(`${application.bankName}の融資審査は否決されました。理由:${result.reason} / 担当:${(application.employeeNames ?? []).join("・") || "-"}`);
    return null;
  }

  const conditionChanged = result.conditionChanged === true || result.reduced === true || Math.abs((result.annualRate ?? 0) - (BANKS[application.bankId]?.rate ?? 0)) >= 0.0001;
  const approvalMessage =
    `${application.bankName}の融資審査が${result.reduced ? "減額承認" : "承認"}されました。\n\n` +
    `希望額: ${(application.requestedAmount ?? 0).toLocaleString()}万円\n` +
    `承認額: ${result.approvedAmount.toLocaleString()}万円\n` +
    `金利: ${(result.annualRate * 100).toFixed(2)}%\n` +
    `返済期間: ${result.years}年\n` +
    `月返済: ${result.monthlyPayment.toLocaleString()}万円\n\n` +
    `${conditionChanged ? "希望条件から変更があります。この条件で借入しますか？" : "この条件で借入しますか？"}`;

  const acceptLoan = window.confirm(approvalMessage);

  if (!acceptLoan) {
    eventLog.push(
      `${application.bankName}の融資承認を辞退しました。承認額${result.approvedAmount.toLocaleString()}万円 / 金利${(result.annualRate * 100).toFixed(2)}% / 担当:${(application.employeeNames ?? []).join("・") || "-"}`
    );
    return null;
  }

  const approvedLoan = normalizeLoan({
    bankId: application.bankId,
    bankName: application.bankName,
    principal: result.approvedAmount,
    remaining: result.approvedAmount,
    annualRate: result.annualRate,
    years: result.years,
    monthsLeft: result.years * 12,
    monthlyPayment: result.monthlyPayment,
    borrowedAt: gameDate.label,
  });

  reviewedLoans = [approvedLoan, ...reviewedLoans];
  loanApprovalTotal += result.approvedAmount;

  eventLog.push(
    `${application.bankName}の融資審査が${result.reduced ? "減額承認" : "承認"}され、借入を実行しました。希望額${(application.requestedAmount ?? 0).toLocaleString()}万円 → 承認額${result.approvedAmount.toLocaleString()}万円 / 金利${(result.annualRate * 100).toFixed(2)}% / 月返済${result.monthlyPayment.toLocaleString()}万円 / 担当:${(application.employeeNames ?? []).join("・") || "-"}`
  );

  return null;
}).filter(Boolean);

nextLoans = reviewedLoans;

if (completedLoanEmployeeIds.length > 0) {
  grantEmployeesExp(completedLoanEmployeeIds, 24, "融資審査対応");
}

if (completedLoanConsultationEmployeeIds.length > 0) {
  grantEmployeesExp(completedLoanConsultationEmployeeIds, 12, "融資相談");
}

let corporateTax = 0;
let finalNet = net;

if (gameDate.month === 3) {
  corporateTax = Math.max(0, Math.round((updatedAnnualStats.net ?? 0) * 0.3));
  finalNet -= corporateTax;
  if (corporateTax > 0) {
    eventLog.push(`法人税・事業税等 ${corporateTax}万円を支払いました`);
  }
}

    setMoney(money + finalNet + loanApprovalTotal);
    setLoans(nextLoans);
    setPendingLoanApplications(nextPendingLoanApplications);
    setPendingLoanConsultations(nextPendingLoanConsultations);
    setLoanConsultationReports((current) => {
      const activeReports = current
        .map(normalizeLoanConsultationReport)
        .filter(Boolean)
        .map((report) => ({
          ...report,
          createdMonth: report.createdMonth ?? month,
          expiresMonth: report.expiresMonth ?? month + 6,
        }))
        .filter((report) => report.used !== true)
        .filter((report) => month + 1 < report.expiresMonth);

      const expiredCount = current.length - activeReports.length;
      if (expiredCount > 0) {
        eventLog.push(`有効期限切れの融資相談結果${expiredCount}件を整理しました。`);
      }

      return [
        ...completedLoanConsultationReports,
        ...activeReports,
      ].slice(0, 12);
    });
    setMonth(month + 1);
    setActionPoints(companyActionPower);

const monthlyHistoryRecord = {
  label: gameDate.label,
  month,
  income,
  maintenance,
  tax: taxPayment,
  purchase: purchasePaymentTotal,
  loan: loanPaymentTotal,
  corporateTax,
  net: finalNet,
  money: money + finalNet + loanApprovalTotal,
  loanApproval: loanApprovalTotal,
};
setMonthlyCompanyHistory((prev) => [monthlyHistoryRecord, ...prev].slice(0, 120));

if (gameDate.month === 3) {
  const report = {
    yearLabel: `${gameDate.year}年目`,
    ...updatedAnnualStats,
    corporateTax,
    netAfterTax: (updatedAnnualStats.net ?? 0) - corporateTax,
    money: money + finalNet + loanApprovalTotal,
  loanApproval: loanApprovalTotal,
    assetValue: Math.round(assetValue),
    playerRank,
    playerExp,
    nextPlayerExp: getPlayerRequiredExp(playerRank),
  };
  setAnnualReport(report);
  setAnnualReportHistory((prev) => [report, ...prev].slice(0, 30));
  setAnnualStats({ income: 0, maintenance: 0, tax: 0, purchase: 0, net: 0 });
} else {
  setAnnualStats(updatedAnnualStats);
}

const taxText =
  taxPayment > 0 ? ` / 固定資産税${taxPayment}万円` : "";
const purchaseText =
  purchasePaymentTotal > 0 ? ` / 土地購入支払${purchasePaymentTotal}万円` : "";
const corporateTaxText =
  corporateTax > 0 ? ` / 法人税等${corporateTax}万円` : "";
const loanText =
  loanPaymentTotal > 0 ? ` / 銀行返済${loanPaymentTotal.toLocaleString()}万円` : "";
const loanApprovalText =
  loanApprovalTotal > 0 ? ` / 融資入金${loanApprovalTotal.toLocaleString()}万円` : "";

const visibleEventLog = eventLog.filter((line) => {
  const hiddenNpcPhrases = [
    "他人に買われました",
    "町に",
    "築古の",
    "が売りに出ました",
    "建て替わりました",
    "取り壊され、更地になりました",
  ];

  return !hiddenNpcPhrases.some((phrase) => line.includes(phrase));
});

const monthLog =
  `${gameDate.label}終了：家賃${income}万円 / 維持費${maintenance}万円${taxText}${purchaseText}${loanText} / 差引${net}万円\n` +
  (visibleEventLog.length ? visibleEventLog.join("\n") : "大きな変化はありません");
setLog(monthLog);

setPopupLog(monthLog);

setLogHistory((prev) => [monthLog, ...prev].slice(0, 200));
  }


function newGame() {
  const ok = window.confirm(
    "マップだけをリセットしますか？\n\n社員・社員保管庫・社員チケットは残ります。"
  );
  if (!ok) return;

  setMoney(20000);
  setPlayerCompanyName(playerCompanyName || DEFAULT_COMPANY_NAME);
  setLoans([]);
  setPendingLoanApplications([]);
  setPendingLoanConsultations([]);
  setLoanConsultationReports([]);
  setLoanAmountInput("5000");
  setSelectedBankId("regional");
  setMonth(1);
  setPlayerRank(1);
  setPlayerExp(0);
  playerRankRef.current = 1;
  playerExpRef.current = 0;
  setPlayerRankUpResult(null);

  const newMap = createMap();

  setTiles(newMap.tiles);
  setSelectedId(null);
  setHqPlaced(false);
  setActivePanel("hq");
  setActionPoints(0);
  setEmployeeCandidates([]);
  setEmployeeGachaResult(null);
  setSelectedEmployeeDetail(null);

  setLog("マップをリセットしました。社員データは残っています。最初に本社を設置してください。");
}

function fullResetGame() {
  const ok = window.confirm(
    "全データを削除して最初から始めますか？\n\nマップ・社員・社員保管庫・社員チケット・ログがすべて消えます。"
  );
  if (!ok) return;

  localStorage.removeItem("realEstateGameSave");
  localStorage.removeItem(getSaveSlotKey(activeSaveSlot));

  const newMap = createMap();

  setMoney(20000);
  setLoans([]);
  setPendingLoanApplications([]);
  setPendingLoanConsultations([]);
  setLoanConsultationReports([]);
  setLoanAmountInput("5000");
  setSelectedBankId("regional");
  setMonth(1);
  setPlayerRank(1);
  setPlayerExp(0);
  playerRankRef.current = 1;
  playerExpRef.current = 0;
  setPlayerRankUpResult(null);
  setTiles(newMap.tiles);
  setSelectedId(null);
  setHqPlaced(false);
  setActivePanel("hq");
  setEmployees([]);
  setEmployeeCandidates([]);
  setEmployeeStorage([]);
  setActionPoints(0);
  setEmployeeTickets(1);
  setPremiumEmployeeTickets(0);
  setEmployeeSortKey("rarity");
  setEmployeeSortDirection("desc");
  setLogHistory([]);
  setPopupLog(null);
  setAnnualReport(null);
  setAnnualStats({ income: 0, maintenance: 0, tax: 0, purchase: 0, net: 0 });
  setMonthlyCompanyHistory([]);
  setAnnualReportHistory([]);
  setPlayerCompanyName(DEFAULT_COMPANY_NAME);
  setNewCompanyNameInput(DEFAULT_COMPANY_NAME);
  setPlayerRankUpResult(null);
  setTicketRewardResult(null);
  setSelectedCompanyDetail(null);
  setEmployeeGachaResult(null);
  setSelectedEmployeeDetail(null);

  setLog("全データをリセットしました。最初に本社を設置してください。");
}

function getLoanConsultationBaseLimit(bankId) {
  const bank = BANKS[bankId] ?? BANKS.regional;
  const capacity = loanCapacityByBank[bank.id];
  const remainingLimit = Math.max(0, capacity?.remainingLimit ?? 0);

  if (bank.id === "nonbank") {
    return Math.max(500, Math.round(remainingLimit));
  }

  return Math.max(0, Math.round(remainingLimit));
}

function getLoanOutlookLabel(recommendedAmount, estimatedMax, bankId) {
  if (recommendedAmount <= 0 || estimatedMax <= 0) return "非常に厳しい";
  if (bankId === "nonbank" && recommendedAmount >= 500) return "高い";
  if (recommendedAmount >= estimatedMax * 0.78) return "非常に高い";
  if (recommendedAmount >= estimatedMax * 0.55) return "高い";
  if (recommendedAmount >= estimatedMax * 0.32) return "五分五分";
  return "低い";
}

function buildLoanConsultationComment(bank, report) {
  const minText = report.estimatedMin.toLocaleString();
  const maxText = report.estimatedMax.toLocaleString();
  const recText = report.recommendedAmount.toLocaleString();
  const commentsByBank = {
    nonbank: {
      strong: [
        `銀行が厳しい局面でも、${recText}万円前後なら当社系の資金調達は十分狙えます。ただし金利負担は重いです。`,
        `急ぎ資金なら${minText}万〜${maxText}万円の範囲で相談余地があります。短期で返す前提なら使いやすいです。`,
      ],
      normal: [
        `${recText}万円程度までなら可能性があります。長期保有資金というより、つなぎ資金として考えた方が安全です。`,
        `審査は柔軟ですが金利は高めです。${minText}万〜${maxText}万円の範囲で抑えるのが現実的です。`,
      ],
      weak: [
        `現状でも少額なら相談できますが、返済負担には注意が必要です。${recText}万円以下に抑えたいです。`,
        `銀行よりは柔軟ですが、今の財務だと大きな金額は危険です。まずは小口が無難です。`,
      ],
    },
    regional: {
      strong: [
        `地域での実績を見る限り、${recText}万円前後ならかなり前向きに見てもらえそうです。`,
        `${minText}万〜${maxText}万円の範囲なら相談しやすいです。特に${recText}万円程度なら現実的です。`,
      ],
      normal: [
        `${recText}万円程度なら可能性があります。空室や返済後利益の説明をしっかり準備したいです。`,
        `${minText}万〜${maxText}万円あたりが目安です。希望額を欲張りすぎなければ勝負できます。`,
      ],
      weak: [
        `今の状況だと大きな金額は厳しめです。${recText}万円以下まで抑えるなら相談余地があります。`,
        `地方銀行でも慎重に見られそうです。まずは小口で実績を作る方が安全です。`,
      ],
    },
    shinkin: {
      strong: [
        `返済計画が整えば、${recText}万円前後まで十分狙えます。資料の見せ方が大事です。`,
        `${minText}万〜${maxText}万円の範囲なら検討余地があります。安定経営を強く説明したいです。`,
      ],
      normal: [
        `${recText}万円程度なら五分五分以上です。既存借入と空室率の説明を用意しましょう。`,
        `信金は堅実性を見ます。${minText}万〜${maxText}万円の範囲で控えめに申請したいです。`,
      ],
      weak: [
        `今の財務だと慎重に見られます。${recText}万円以下に抑えて、返済計画を固めたいです。`,
        `黒字幅や満室率を改善できれば見え方が変わります。今回は小口が無難です。`,
      ],
    },
    megabank: {
      strong: [
        `財務内容は悪くありません。${recText}万円前後なら本審査に進める可能性があります。`,
        `${minText}万〜${maxText}万円の範囲なら検討余地があります。ただし資料の精度はかなり求められます。`,
      ],
      normal: [
        `メガバンクは厳しめです。${recText}万円程度まで抑えれば可能性はありますが、五分五分です。`,
        `低金利は魅力ですが審査は重いです。${minText}万〜${maxText}万円が目安になります。`,
      ],
      weak: [
        `現状ではメガバンクはかなり厳しいです。まずは地銀か信金で実績を作る方が良さそうです。`,
        `財務の安定性をもう少し見せたいです。今すぐなら金額をかなり抑える必要があります。`,
      ],
    },
  };

  const tier = report.outlookLabel === "非常に高い" || report.outlookLabel === "高い"
    ? "strong"
    : report.outlookLabel === "五分五分"
      ? "normal"
      : "weak";
  const list = commentsByBank[bank.id]?.[tier] ?? commentsByBank.regional[tier];
  const indexSeed = Math.abs((report.recommendedAmount ?? 0) + (report.consultationPower ?? 0) + bank.name.length);
  return list[indexSeed % list.length];
}

function calculateLoanConsultationReport(consultation) {
  const bank = BANKS[consultation?.bankId] ?? BANKS.regional;
  const baseLimit = getLoanConsultationBaseLimit(bank.id);
  const consultationPower = Math.max(0, Math.round(consultation?.consultationPower ?? 0));
  const precision = Math.max(0.18, Math.min(0.75, 0.18 + consultationPower / 150));
  const blurRate = Math.max(0.12, 0.75 - precision);
  const bankConservatism = bank.id === "nonbank" ? 0.88 : bank.id === "regional" ? 0.82 : bank.id === "shinkin" ? 0.76 : 0.68;
  const recommendedAmount = Math.max(0, Math.round(baseLimit * bankConservatism / 100) * 100);
  const spread = Math.max(500, Math.round(Math.max(baseLimit, 1000) * blurRate / 100) * 100);
  const estimatedMin = Math.max(0, Math.round(Math.max(0, recommendedAmount - spread) / 100) * 100);
  const estimatedMax = Math.max(estimatedMin, Math.round((recommendedAmount + spread) / 100) * 100);
  const outlookLabel = getLoanOutlookLabel(recommendedAmount, estimatedMax, bank.id);
  const riskNotes = [];

  if ((loanCapacityByBank[bank.id]?.rankOk ?? true) === false) riskNotes.push(`ランク${bank.minRank}以上が必要`);
  if ((loanCapacityByBank[bank.id]?.dscrOk ?? true) === false) riskNotes.push("返済余力が弱い");
  if ((loanCapacityByBank[bank.id]?.debtOk ?? true) === false) riskNotes.push("借入比率が高い");
  if (monthlyProfit - totalMonthlyLoanPayment <= 0) riskNotes.push("返済後月利益が少ない");
  if (vacancyRate >= 30) riskNotes.push("空室率が高い");
  if (baseLimit <= 0) riskNotes.push("追加借入枠がほぼない");

  const reportBase = {
    id: `loan-report-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bankId: bank.id,
    bankName: bank.name,
    reportedAt: gameDate.label,
    createdMonth: month,
    expiresMonth: month + 6,
    employeeName: consultation?.employeeName ?? "",
    estimatedMin,
    estimatedMax,
    recommendedAmount,
    outlookLabel,
    riskNotes,
    consultationPower,
  };

  return normalizeLoanConsultationReport({
    ...reportBase,
    comment: buildLoanConsultationComment(bank, reportBase),
  });
}

async function startLoanConsultation(bankId) {
  const bank = BANKS[bankId];
  if (!bank) return;

  const alreadyPending = pendingLoanConsultations.some((consultation) => consultation.bankId === bank.id);
  if (alreadyPending) {
    window.alert(`${bank.name}にはすでに融資相談中です。結果を待ってください。`);
    return;
  }

  const actionEmployees = await chooseActionEmployees("融資相談", {
    maxCount: 1,
    baseMonths: 1,
    statKey: "sales",
  });

  if (actionEmployees.length === 0) return;

  const employee = actionEmployees[0];
  const consultationPower = Math.round((employee.sales ?? 0) * 0.6 + (employee.management ?? 0) * 0.4);

  const ok = window.confirm(
    `${bank.name}へ融資相談を行いますか？\n\n` +
      `担当: ${employee.name}\n` +
      `相談力: ${consultationPower}\n` +
      `期間: 1ヶ月\n\n` +
      `※相談結果では、推定融資枠・銀行員コメントが確認できます。`
  );

  if (!ok) return;

  const consultation = normalizePendingLoanConsultation({
    bankId: bank.id,
    bankName: bank.name,
    monthsLeft: 1,
    requestedAt: gameDate.label,
    employeeId: employee.id,
    employeeName: employee.name,
    consultationPower,
    sales: employee.sales ?? 0,
    management: employee.management ?? 0,
  });

  setPendingLoanConsultations((current) => [consultation, ...current]);
  markEmployeesBusy([employee.id], 1, "融資相談");

  const message = `${bank.name}へ融資相談を依頼しました。結果は1ヶ月後です。担当:${employee.name} / 相談力:${consultationPower}`;
  setLog(message);
  setLogHistory((prev) => [message, ...prev].slice(0, 200));
}

async function borrowFromBank(bankId, overrideAmount = null, consultationReport = null) {
  const bank = BANKS[bankId];
  if (!bank) return;

  const rawAmount = overrideAmount ?? loanAmountInput;
  const amount = Math.round(Number(rawAmount));
  if (overrideAmount !== null && overrideAmount !== undefined) {
    setSelectedBankId(bank.id);
    setLoanAmountInput(String(amount));
  }
  const capacity = loanCapacityByBank[bankId];

  if (!Number.isFinite(amount) || amount <= 0) {
    window.alert("借入希望額を正しく入力してください。");
    return;
  }

  const warningMessages = [];
  if (!capacity?.rankOk) warningMessages.push(`現在のランクでは${bank.name}の通常基準に届いていません`);
  if (!capacity?.dscrOk) warningMessages.push("返済余力が弱く見られる可能性があります");
  if (!capacity?.debtOk) warningMessages.push("借入比率が高く見られる可能性があります");
  if (amount > (capacity?.remainingLimit ?? 0)) warningMessages.push(`希望額が推定枠${(capacity?.remainingLimit ?? 0).toLocaleString()}万円を超えています`);

  const warningText = warningMessages.length > 0
    ? `\n事前注意:\n・${warningMessages.join("\n・")}\n`
    : "";

  const consultationInfoText = consultationReport
    ? `\n相談結果連動: ${consultationReport.bankName} / 推奨${(consultationReport.recommendedAmount ?? 0).toLocaleString()}万円 / 担当:${consultationReport.employeeName || "-"}\n`
    : "";

  const reviewMonths = getLoanReviewMonths(amount);
  const actionEmployees = await chooseActionEmployees("融資申請", {
    maxCount: 4,
    baseMonths: reviewMonths,
    statKey: "sales",
  });

  if (actionEmployees.length === 0) return;

  const negotiationPower = getLoanNegotiationPower(actionEmployees);
  const salesAverage = getLoanTeamAverage(actionEmployees, "sales");
  const managementAverage = getLoanTeamAverage(actionEmployees, "management");
  const leadershipAverage = getLoanTeamAverage(actionEmployees, "leadership");

  const ok = window.confirm(
    `${bank.name}へ融資申請しますか？

` +
      `希望額: ${amount.toLocaleString()}万円
` +
      `標準金利: ${(bank.rate * 100).toFixed(1)}%
` +
      `返済期間: ${bank.maxYears}年
` +
      `審査期間: ${reviewMonths}ヶ月
` +
      `担当: ${actionEmployees.map((employee) => employee.name).join("・")}
` +
      `融資交渉力: ${negotiationPower}
` +
      `${consultationInfoText}` +
      `${warningText}
` +
      `※申請自体は可能です。申請時点では入金されず、審査完了後に承認額が入金されます。`
  );

  if (!ok) return;

  const application = normalizePendingLoanApplication({
    bankId: bank.id,
    bankName: bank.name,
    requestedAmount: amount,
    reviewMonths,
    monthsLeft: reviewMonths,
    appliedAt: gameDate.label,
    employeeIds: actionEmployees.map((employee) => employee.id),
    employeeNames: actionEmployees.map((employee) => employee.name),
    negotiationPower,
    salesAverage,
    managementAverage,
    leadershipAverage,
    consultationReportId: consultationReport?.id ?? null,
    consultationRecommendedAmount: consultationReport?.recommendedAmount ?? 0,
    consultationEstimatedMin: consultationReport?.estimatedMin ?? 0,
    consultationEstimatedMax: consultationReport?.estimatedMax ?? 0,
    consultationPower: consultationReport?.consultationPower ?? 0,
    consultationEmployeeName: consultationReport?.employeeName ?? "",
  });

  if (!application) return;

  setPendingLoanApplications((current) => [application, ...current]);

  if (consultationReport?.id) {
    setLoanConsultationReports((current) => current.filter((report) => report.id !== consultationReport.id));
    setConsultationApplicationAmounts((current) => {
      const nextAmounts = { ...current };
      delete nextAmounts[consultationReport.id];
      return nextAmounts;
    });
  }

  markEmployeesBusy(actionEmployees.map((employee) => employee.id), reviewMonths, "融資申請");

  const message = `${bank.name}へ${amount.toLocaleString()}万円の融資申請を行いました。審査期間${reviewMonths}ヶ月 / 担当:${actionEmployees.map((employee) => employee.name).join("・")} / 融資交渉力:${negotiationPower}`;
  setLog(message);
  setLogHistory((prev) => [message, ...prev].slice(0, 200));
}

function calculateLoanReviewResult(application, currentLoans = loans) {
  const bank = BANKS[application?.bankId] ?? BANKS.regional;
  const requestedAmount = Math.max(0, Math.round(application?.requestedAmount ?? 0));
  const negotiationPower = Math.max(0, Math.round(application?.negotiationPower ?? 0));
  const salesAverage = Math.max(0, Math.round(application?.salesAverage ?? 0));
  const managementAverage = Math.max(0, Math.round(application?.managementAverage ?? 0));
  const leadershipAverage = Math.max(0, Math.round(application?.leadershipAverage ?? 0));
  const consultationRecommendedAmount = Math.max(0, Math.round(application?.consultationRecommendedAmount ?? 0));
  const consultationEstimatedMax = Math.max(0, Math.round(application?.consultationEstimatedMax ?? 0));
  const consultationPower = Math.max(0, Math.round(application?.consultationPower ?? 0));
  const hasConsultationSupport = consultationRecommendedAmount > 0;
  const withinConsultationRecommended = hasConsultationSupport && requestedAmount <= consultationRecommendedAmount * 1.08;
  const withinConsultationMax = consultationEstimatedMax > 0 && requestedAmount <= consultationEstimatedMax;
  const currentLoanRemaining = currentLoans.reduce((sum, loan) => sum + (loan.remaining ?? 0), 0);
  const currentMonthlyPayment = currentLoans.reduce((sum, loan) => sum + (loan.monthlyPayment ?? 0), 0);
  const currentDebtRatio = assetValue <= 0
    ? (currentLoanRemaining > 0 ? 100 : 0)
    : Math.round((currentLoanRemaining / assetValue) * 100);
  const yearlyNetIncome = Math.max(0, monthlyProfit - currentMonthlyPayment) * 12;
  const incomeCapacity = yearlyNetIncome * bank.approvalMultiplier;
  const collateralCapacity = assetValue * bank.collateralRate;
  const rankBonus = Math.max(0, playerRank - bank.minRank) * 1500;
  const cashBuffer = Math.max(0, money) * 0.35;
  const baseLimit = Math.max(0, Math.round(incomeCapacity + collateralCapacity + rankBonus + cashBuffer));
  const nonbankStartupLimit = bank.id === "nonbank" ? Math.max(1000, Math.min(5000, Math.round(Math.max(money * 0.5, assetValue * 0.18 + money * 0.4 + 1200)))) : 0;
  const grossLimit = bank.id === "nonbank" ? Math.max(baseLimit, nonbankStartupLimit) : baseLimit;
  const remainingLimit = Math.max(0, grossLimit - currentLoanRemaining);

  const regionalSmallLoanSupport = bank.id === "regional" && requestedAmount <= 5000;
  const nonbankSmallLoanSupport = bank.id === "nonbank" && requestedAmount <= 5000;
  const consultationScoreBonus = withinConsultationRecommended
    ? Math.max(18, Math.min(34, 16 + consultationPower * 0.22))
    : withinConsultationMax
      ? Math.max(8, Math.min(18, 6 + consultationPower * 0.12))
      : 0;
  const regionalSmallLoanSupportBonus = regionalSmallLoanSupport ? 28 : 0;
  const financialScore = Math.max(0, Math.min(100,
    50 +
      regionalSmallLoanSupportBonus +
      Math.min(20, yearlyNetIncome / 1200) +
      Math.min(15, money / 3000) +
      Math.min(15, assetValue / 20000) -
      Math.min(30, currentDebtRatio * 0.35) -
      Math.min(20, vacancyRate * 0.35)
  ));

  const bankDifficulty = bank.id === "nonbank" ? (nonbankSmallLoanSupport ? 18 : 28) : bank.id === "regional" ? (regionalSmallLoanSupport ? 24 : 40) : bank.id === "shinkin" ? 55 : 68;
  const amountPressure = requestedAmount >= 20000 ? 10 : requestedAmount >= 5000 ? 5 : 0;
  const managementBonus = (managementAverage - 50) * 0.28;
  const leadershipBonus = requestedAmount >= 20000 || bank.id === "megabank"
    ? (leadershipAverage - 50) * 0.22
    : (leadershipAverage - 50) * 0.1;
  const finalScore = financialScore + consultationScoreBonus + (negotiationPower - 50) * 0.38 + managementBonus + leadershipBonus - amountPressure;
  const hasRepaymentSource = monthlyProfit > 0 || regionalSmallLoanSupport || bank.id === "nonbank" || withinConsultationRecommended;
  const allowedDebtRatio = regionalSmallLoanSupport ? 115 : bank.id === "nonbank" ? 125 : 92;
  const rankPass = playerRank >= bank.minRank || regionalSmallLoanSupport || nonbankSmallLoanSupport;
  const canApprove =
    requestedAmount > 0 &&
    rankPass &&
    remainingLimit > 0 &&
    hasRepaymentSource &&
    currentDebtRatio <= allowedDebtRatio &&
    finalScore >= bankDifficulty;

  if (!canApprove) {
    const reducedBaseAmount = hasConsultationSupport
      ? Math.min(consultationRecommendedAmount || requestedAmount, requestedAmount * 0.9)
      : Math.min(remainingLimit * 0.88, requestedAmount * 0.72);
    const reducedPossibleAmount = Math.max(0, Math.round(Math.min(remainingLimit, reducedBaseAmount) / 100) * 100);
    const reducedApproveScoreLine = bank.id === "nonbank" ? bankDifficulty - 18 : bank.id === "regional" ? bankDifficulty - 16 : bank.id === "shinkin" ? bankDifficulty - 12 : bankDifficulty - 8;
    const canReducedApprove =
      reducedPossibleAmount >= 500 &&
      rankPass &&
      hasRepaymentSource &&
      currentDebtRatio <= allowedDebtRatio + 18 &&
      finalScore >= reducedApproveScoreLine;

    const minimumReductionRatio = bank.id === "nonbank" ? 0.35 : 0.6;
    const reducedRatio = requestedAmount > 0 ? reducedPossibleAmount / requestedAmount : 0;

    if (canReducedApprove && reducedRatio >= minimumReductionRatio) {
      const reducedAnnualRate = Math.max(0.006, bank.rate + 0.0025 - Math.max(0, (salesAverage - 50) * 0.00004));
      const reducedMonthlyPayment = calculateMonthlyLoanPayment(reducedPossibleAmount, reducedAnnualRate, bank.maxYears);

      return {
        approved: true,
        reduced: true,
        conditionChanged: true,
        approvedAmount: reducedPossibleAmount,
        annualRate: reducedAnnualRate,
        years: bank.maxYears,
        monthlyPayment: reducedMonthlyPayment,
        finalScore: Math.round(finalScore),
        financialScore: Math.round(financialScore),
      };
    }

    const reasons = [];
    if (!rankPass) reasons.push(`ランク不足`);
    if (remainingLimit <= 0) reasons.push(`追加借入余力不足`);
    if (!hasRepaymentSource) reasons.push(`返済原資不足`);
    if (currentDebtRatio > allowedDebtRatio) reasons.push(`借入比率過大`);
    if (finalScore < bankDifficulty) reasons.push(`審査評価不足`);

    return {
      approved: false,
      reason: reasons.join("・") || "審査否決",
      finalScore: Math.round(finalScore),
      financialScore: Math.round(financialScore),
    };
  }

  const scoreRate = Math.max(0.78, Math.min(1.16, 0.9 + (finalScore - bankDifficulty) * 0.01));
  const salesRate = Math.max(-0.08, Math.min(0.1, (salesAverage - 50) * 0.002));
  const managementRate = Math.max(-0.06, Math.min(0.08, (managementAverage - 50) * 0.0015));
  const approvalRate = Math.max(0.55, Math.min(1.0, scoreRate + salesRate + managementRate));
  const approvedAmount = Math.max(100, Math.min(requestedAmount, remainingLimit, Math.round(requestedAmount * approvalRate)));
  const minimumApprovalRatio = bank.id === "nonbank" ? 0.35 : 0.6;
  const approvalRatio = requestedAmount > 0 ? approvedAmount / requestedAmount : 0;

  if (approvalRatio < minimumApprovalRatio) {
    return {
      approved: false,
      reason: `希望額に対して承認可能額が大きく不足`,
      finalScore: Math.round(finalScore),
      financialScore: Math.round(financialScore),
    };
  }

  const rateDiscount = Math.max(-0.002, Math.min(0.0045, (salesAverage - 50) * 0.00008 + (financialScore - 50) * 0.00004));
  const annualRate = Math.max(0.006, bank.rate - rateDiscount);
  const monthlyPayment = calculateMonthlyLoanPayment(approvedAmount, annualRate, bank.maxYears);
  const amountChanged = approvedAmount !== requestedAmount;
  const rateChanged = Math.abs(annualRate - bank.rate) >= 0.0001;

  return {
    approved: true,
    reduced: approvedAmount < requestedAmount,
    conditionChanged: amountChanged || rateChanged,
    approvedAmount,
    annualRate,
    years: bank.maxYears,
    monthlyPayment,
    finalScore: Math.round(finalScore),
    financialScore: Math.round(financialScore),
  };
}

function repayLoanEarly(loanId) {
  const targetLoan = loans.find((loan) => loan.id === loanId);
  if (!targetLoan) return;

  if (money < targetLoan.remaining) {
    window.alert(`一括返済には${targetLoan.remaining.toLocaleString()}万円が必要です。`);
    return;
  }

  const ok = window.confirm(`${targetLoan.bankName}の借入残高${targetLoan.remaining.toLocaleString()}万円を一括返済しますか？`);
  if (!ok) return;

  setMoney((current) => current - targetLoan.remaining);
  setLoans((current) => current.filter((loan) => loan.id !== loanId));

  const message = `${targetLoan.bankName}の借入を一括返済しました。返済額${targetLoan.remaining.toLocaleString()}万円。`;
  setLog(message);
  setLogHistory((prev) => [message, ...prev].slice(0, 200));
}

function handleMapPointerDown(event) {
  if (!mapScrollRef.current) return;

  mapDragStateRef.current = {
    ...mapDragStateRef.current,
    isPointerDown: true,
    isDragging: false,
    moved: false,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: mapScrollRef.current.scrollLeft,
    scrollTop: mapScrollRef.current.scrollTop,
  };
}

function handleMapPointerMove(event) {
  const state = mapDragStateRef.current;
  if (!state.isPointerDown || !mapScrollRef.current) return;

  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!state.isDragging && distance < 6) {
    return;
  }

  mapDragStateRef.current.isDragging = true;
  mapDragStateRef.current.moved = true;
  mapScrollRef.current.scrollLeft = state.scrollLeft - dx;
  mapScrollRef.current.scrollTop = state.scrollTop - dy;
  event.preventDefault();
}

function handleMapPointerUp() {
  const wasDragging = mapDragStateRef.current.moved;

  mapDragStateRef.current = {
    ...mapDragStateRef.current,
    isPointerDown: false,
    isDragging: false,
    moved: false,
    lastDragEndedAt: wasDragging ? Date.now() : mapDragStateRef.current.lastDragEndedAt,
  };
}

function shouldIgnoreTileClickAfterDrag() {
  return Date.now() - mapDragStateRef.current.lastDragEndedAt < 180;
}

function getLandPriceColor(price) {

  if (price <= 300) return "#00104d";     // 深海青
  if (price <= 500) return "#002b99";     // 濃青
  if (price <= 700) return "#004dff";     // 青
  if (price <= 900) return "#0088ff";     // 明青
  if (price <= 1200) return "#00ccff";    // 水色
  if (price <= 1600) return "#00ffd5";    // シアン
  if (price <= 2200) return "#00cc66";    // 緑
  if (price <= 3000) return "#66cc00";    // 黄緑
  if (price <= 4000) return "#ccff00";    // ライム黄
  if (price <= 5500) return "#ffff00";    // 黄
  if (price <= 7000) return "#ffcc00";    // 黄橙
  if (price <= 9000) return "#ff8800";    // オレンジ
  if (price <= 12000) return "#ff0000";   // 赤

  return "#9900cc"; // 紫（1.2億超）
}

function getHousingDemandColor(score) {
  if (score < 50) return "#1e3a8a";
  if (score < 60) return "#2563eb";
  if (score < 70) return "#38bdf8";
  if (score < 80) return "#86efac";
  if (score < 90) return "#22c55e";
  if (score < 100) return "#a3e635";
  if (score < 110) return "#fde047";
  if (score < 120) return "#fb923c";
  if (score < 130) return "#ef4444";

  return "#a855f7";
}

function getHousingDemandScore(tile) {
  let score = 70;

  const stationDistance = getNearestPointDistance(tile.x, tile.y, stationPositions, stationPos.x, stationPos.y);
  const schoolDistance = getNearestPointDistance(tile.x, tile.y, schoolPositions, schoolPos.x, schoolPos.y);
  const factoryDistance = getDistance(tile.x, tile.y, factoryPos.x, factoryPos.y);

  score += Math.max(0, 60 - stationDistance * 8);
  score += Math.max(0, 18 - schoolDistance * 3);

  if (factoryDistance <= 2) {
    score -= 25;
  } else if (factoryDistance <= 4) {
    score -= 12;
  }
  const nearbyIndustrialBuildings = tiles.filter((t) => {
  if (!t.building || t.buildingMainId) return false;

  const category = BUILDINGS[t.building]?.category;

  return (
    category === "工業" &&
    getDistance(tile.x, tile.y, t.x, t.y) <= 4
  );
}).length;

score -= Math.min(25, nearbyIndustrialBuildings * 6);
const nearbyHousingBuildings = tiles.filter((t) => {
  if (!t.building || t.buildingMainId) return false;

  const category = BUILDINGS[t.building]?.category;

  return (
    (category === "住宅" ||
      category === "住宅" ||
      category === "住宅") &&
    getDistance(tile.x, tile.y, t.x, t.y) <= 3
  );
}).length;

score += Math.min(12, nearbyHousingBuildings * 2);
  score += Math.min(10, tile.landPrice / 1500);

return Math.max(30, Math.min(140, Math.round(score)));
}

function getCommercialDemandColor(score) {
  if (score < 50) return "#1e3a8a";
  if (score < 60) return "#2563eb";
  if (score < 70) return "#38bdf8";
  if (score < 80) return "#86efac";
  if (score < 90) return "#22c55e";
  if (score < 100) return "#a3e635";
  if (score < 110) return "#fde047";
  if (score < 120) return "#fb923c";
  if (score < 130) return "#ef4444";

  return "#a855f7";
}

function getCommercialDemandScore(tile, tiles) {
  let score = 60;

  const stationTiles = tiles.filter(
    (t) => t.feature === FEATURE.STATION
  );

  const stationDistance =
    stationTiles.length > 0
      ? Math.min(
          ...stationTiles.map((station) =>
            getDistance(tile.x, tile.y, station.x, station.y)
          )
        )
      : 999;

  const roadNearby = tiles.some(
    (t) =>
      t.feature === FEATURE.ROAD &&
      getDistance(tile.x, tile.y, t.x, t.y) <= 1
  );

  const nearbyHousing = tiles.filter((t) => {
    if (!t.building || t.buildingMainId) return false;

    const category = BUILDINGS[t.building]?.category;

    return (
      (category === "住宅" ||
        category === "住宅" ||
        category === "住宅") &&
      getDistance(tile.x, tile.y, t.x, t.y) <= 4
    );
  }).length;

  score += Math.max(0, 80 - stationDistance * 12);

  if (roadNearby) {
    score += 15;
  }

  score += Math.min(20, nearbyHousing * 4);

const nearbyCommercialBuildings = tiles.filter((t) => {
  if (!t.building || t.buildingMainId) return false;

  const category = BUILDINGS[t.building]?.category;

  return (
    category === "商業" &&
    getDistance(tile.x, tile.y, t.x, t.y) <= 4
  );
}).length;

score += Math.min(12, nearbyCommercialBuildings * 3);

const nearbyIndustrialBuildings = tiles.filter((t) => {
  if (!t.building || t.buildingMainId) return false;

  const category = BUILDINGS[t.building]?.category;

  return (
    category === "工業" &&
    getDistance(tile.x, tile.y, t.x, t.y) <= 4
  );
}).length;

score += Math.min(10, nearbyIndustrialBuildings * 2);

score += Math.min(10, tile.landPrice / 1800);

  return Math.max(30, Math.min(140, Math.round(score)));
}
function getIndustrialDemandColor(score) {
  if (score < 50) return "#1e3a8a";
  if (score < 60) return "#2563eb";
  if (score < 70) return "#38bdf8";
  if (score < 80) return "#86efac";
  if (score < 90) return "#22c55e";
  if (score < 100) return "#a3e635";
  if (score < 110) return "#fde047";
  if (score < 120) return "#fb923c";
  if (score < 130) return "#ef4444";

  return "#a855f7";
}

function getIndustrialDemandScore(tile) {
  let score = 55;

  const stationTiles = tiles.filter(
    (t) => t.feature === FEATURE.STATION
  );

  const factoryTiles = tiles.filter(
    (t) => t.feature === FEATURE.FACTORY
  );

  const stationDistance =
    stationTiles.length > 0
      ? Math.min(
          ...stationTiles.map((station) =>
            getDistance(tile.x, tile.y, station.x, station.y)
          )
        )
      : 999;

  const schoolDistance = getNearestPointDistance(tile.x, tile.y, schoolPositions, schoolPos.x, schoolPos.y);

  const factoryDistance =
    factoryTiles.length > 0
      ? Math.min(
          ...factoryTiles.map((factory) =>
            getDistance(tile.x, tile.y, factory.x, factory.y)
          )
        )
      : 999;

  const roadNearby = tiles.some(
    (t) =>
      t.feature === FEATURE.ROAD &&
      getDistance(tile.x, tile.y, t.x, t.y) <= 1
  );

  score += Math.max(0, 35 - factoryDistance * 5);

  if (roadNearby) {
    score += 15;
  }

  if (stationDistance <= 3) {
    score += 8;
  }

  if (schoolDistance <= 4) {
  score -= 18;
}

const nearbyIndustrialBuildings = tiles.filter((t) => {
  if (!t.building || t.buildingMainId) return false;

  const category = BUILDINGS[t.building]?.category;

  return (
    category === "工業" &&
    getDistance(tile.x, tile.y, t.x, t.y) <= 5
  );
}).length;

score += Math.min(18, nearbyIndustrialBuildings * 4);

score += Math.min(8, tile.landPrice / 2500);

  return Math.max(30, Math.min(140, Math.round(score)));
}
function selectNPCBuildingByDemand(tile) {
  const housingScore = getHousingDemandScore(tile);
  const commercialScore = getCommercialDemandScore(tile, tiles);
  const industrialScore = getIndustrialDemandScore(tile);

  const maxScore = Math.max(
    housingScore,
    commercialScore,
    industrialScore
  );

  // 住宅需要が一番高い場所
  if (maxScore === housingScore) {
    const candidates = [
      "house_1f",
      "house_2f",
      "apt_2f_single",
      "apt_2f_family",
    ];

    return candidates[randomInt(0, candidates.length - 1)];
  }

  // 商業需要が一番高い場所
  if (maxScore === commercialScore) {
    const candidates = [
      "convenience",
      "restaurant",
      "drugstore",
      "supermarket",
    ];

    return candidates[randomInt(0, candidates.length - 1)];
  }

  // 工業需要が一番高い場所
  // ※今は工業建物が未実装なので、工場周辺にできやすい建物を選ぶ
const candidates = [
  "small_factory",
  "medium_factory",
  "warehouse",
  "apt_2f_single",
  "convenience",
];

  return candidates[randomInt(0, candidates.length - 1)];
}

// v85正本：v81_nextmonth系の軽量版をベースに、需要マップ時だけ需要色を計算する。
// 通常表示・地価表示では需要計算を完全に呼ばない。
// ユーザー指示：住宅/商業/工業の需要マップ自体は残すが、常時集計・常時計算はしない。
const demandColorByTileId = useMemo(() => {
  if (
    mapViewMode !== "housingDemand" &&
    mapViewMode !== "commercialDemand" &&
    mapViewMode !== "industrialDemand"
  ) {
    return new Map();
  }

  const colorMap = new Map();

  tiles.forEach((targetTile) => {
    if (targetTile.terrain !== TERRAIN.PLAIN) {
      colorMap.set(targetTile.id, "#cccccc");
      return;
    }

    if (mapViewMode === "housingDemand") {
      colorMap.set(
        targetTile.id,
        getHousingDemandColor(getHousingDemandScore(targetTile))
      );
      return;
    }

    if (mapViewMode === "commercialDemand") {
      colorMap.set(
        targetTile.id,
        getCommercialDemandColor(getCommercialDemandScore(targetTile, tiles))
      );
      return;
    }

    if (mapViewMode === "industrialDemand") {
      colorMap.set(
        targetTile.id,
        getIndustrialDemandColor(getIndustrialDemandScore(targetTile))
      );
    }
  });

  return colorMap;
}, [mapViewMode, tiles, stationPositions, schoolPositions, stationPos, schoolPos, factoryPos]);

function getTileColor(tile) {
  // v10: マス本体の背景色は土地・地形・施設情報だけに使う。
  // 行動範囲や建設候補はCSSの枠線で表示する。

  if (mapViewMode === "landPrice") {
    if (tile.terrain !== TERRAIN.PLAIN) return "#cccccc";
    return getLandPriceColor(tile.landPrice);
  }

  if (
    mapViewMode === "housingDemand" ||
    mapViewMode === "commercialDemand" ||
    mapViewMode === "industrialDemand"
  ) {
    return demandColorByTileId.get(tile.id) ?? "#cccccc";
  }

  if (tile.rail && tile.terrain === TERRAIN.RIVER) {
    return "#9b9b9b";
  }

  if (tile.feature === FEATURE.ROAD && tile.terrain === TERRAIN.RIVER) {
    return "#d8d8d8";
  }
if (tile.terrain === TERRAIN.MOUNTAIN) return "#2e8b57";
if (tile.terrain === TERRAIN.RIVER) return "#4aa3ff";
if (tile.terrain === TERRAIN.SEA) return "#0066cc";

if (tile.feature === FEATURE.STATION) return "#ff80ab";

if (tile.feature === FEATURE.ROAD && tile.rail) {
  return "#8a8a8a";
}

if (tile.rail) return "#9b9b9b";

if (tile.feature === FEATURE.SCHOOL) return "#66cc66";
if (tile.feature === FEATURE.FACTORY) return "#777777";
if (tile.owner === OWNER.RIVAL && tile.feature === FEATURE.HQ) return "#eeeeee";
if (tile.owner === OWNER.RIVAL && tile.feature === FEATURE.BRANCH) return "#eeeeee";
if (tile.feature === FEATURE.HQ) return "#ffffff";
if (tile.feature === FEATURE.BRANCH) return "#ffffff";
if (tile.feature === FEATURE.ROAD) return "#d8d8d8";

if (tile.owner === OWNER.PLAYER) return "#ffffff";
if (tile.owner === OWNER.SALE) return "#ffb74d";
if (tile.building) return "#eeeeee";

return "#f7f7f7";
}

function getTileLabel(tile) {
  if (tile.feature === FEATURE.STATION) return "駅";
  if (tile.rail) return "線";
  if (tile.feature === FEATURE.SCHOOL) return "学";
  if (tile.feature === FEATURE.FACTORY) return "工";

  if (tile.purchaseStatus === "purchasing") return "交";

  if (tile.owner === OWNER.RIVAL && tile.feature === FEATURE.HQ) return "敵本";
  if (tile.owner === OWNER.RIVAL && tile.feature === FEATURE.BRANCH) return "敵支";

  if (tile.feature === FEATURE.HQ) {
    if (tile.building === "hq_apartment") {
      return "本A";
    }

    return "本";
  }

  if (tile.feature === FEATURE.BRANCH) {
    const branchLabel = getBranchDisplayName(tile);
    return tile.branchUnderConstruction ? `${branchLabel}工` : branchLabel;
  }

  if (tile.feature === FEATURE.ROAD && tile.terrain === TERRAIN.RIVER) {
    return "橋";
  }

  if (tile.feature === FEATURE.ROAD) return "道";
  if (tile.terrain === TERRAIN.MOUNTAIN) return "山";
  if (tile.terrain === TERRAIN.RIVER) return "川";
  if (tile.terrain === TERRAIN.SEA) return "海";

  if (tile.owner === OWNER.SALE) {
    if (tile.building) {
      return BUILDINGS[tile.building].short;
    }
    return "土";
  }

  if (tile.owner === OWNER.OTHER && !tile.building) {
    return "空";
  }

  if (tile.building && !tile.buildingMainId) {
    if (tile.buildingStatus === "constructing") {
      return "工";
    }

    return BUILDINGS[tile.building]?.short ?? "";
  }

  if (tile.building && tile.buildingMainId) {
    if (tile.buildingStatus === "constructing") {
      return "工";
    }

    return BUILDINGS[tile.building]?.short ?? "";
  }

  if (tile.owner === OWNER.PLAYER) return "自";

  return "";
}
  const selectedMainTile = getMainTile(selectedTile);
  const selectedBuilding =
    selectedMainTile?.building ? BUILDINGS[selectedMainTile.building] : null;


// v79方針：需要指数・住宅需要平均・商業需要平均・工業需要平均の数値表示は停止。
// 理由：70×70マップ全体に対して需要平均を毎回集計すると処理が重くなるため。
// ユーザー指示により、将来復活できるように需要計算関数自体は残すが、この平均集計は実行しない。
const demandAverages = {
  housing: null,
  commercial: null,
  industrial: null,
};

const housingDemandAverage = demandAverages.housing;
const commercialDemandAverage = demandAverages.commercial;
const industrialDemandAverage = demandAverages.industrial;

function getSaveSlotSummaries() {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const data = readSaveSlot(slot);
    if (!data) {
      return { slot, hasData: false };
    }

    const savedDate = data.savedAt ? new Date(data.savedAt) : null;
    const savedAtText = savedDate && !Number.isNaN(savedDate.getTime())
      ? savedDate.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "保存日時不明";

    return {
      slot,
      hasData: true,
      companyName: data.playerCompanyName ?? DEFAULT_COMPANY_NAME,
      month: data.month ?? 1,
      money: data.money ?? 0,
      savedAtText,
    };
  });
}

const saveSlotSummaries = useMemo(() => getSaveSlotSummaries(), [saveSlotRefreshKey, showTitleScreen]);
const hasAnySaveSlot = saveSlotSummaries.some((slot) => slot.hasData);

function getTileOwnerName(tile) {
  if (!tile) return "不明";
  if (tile.owner === OWNER.PLAYER) return playerCompanyName || DEFAULT_COMPANY_NAME;
  if (tile.owner === OWNER.RIVAL) return getRivalCompanyNameFromTiles(tiles, tile.rivalCompanyId);
  return getOwnerName(tile.owner);
}

function saveCurrentGameToSlot(slot = activeSaveSlot) {
  const saveData = {
    playerCompanyName,
    activeSaveSlot: slot,
    savedAt: new Date().toISOString(),
    money,
    loans,
    pendingLoanApplications,
    pendingLoanConsultations,
    loanConsultationReports,
    month,
    hqPlaced,
    tiles,
    selectedId,
    log,
    logHistory: logHistory.slice(0, 200),
    playerRank,
    playerExp,
    employees,
    employeeCandidates,
    employeeStorage,
    actionPoints,
    employeeTickets,
    premiumEmployeeTickets,
    employeeSortKey,
    employeeSortDirection,
    annualStats,
    monthlyCompanyHistory: monthlyCompanyHistory.slice(0, 120),
    annualReportHistory: annualReportHistory.slice(0, 30),
    isDemoMode,
    usedSecretCommands,
  };

  localStorage.setItem("realEstateGameCurrentSlot", String(slot));
  localStorage.setItem(getSaveSlotKey(slot), JSON.stringify(saveData));
  localStorage.setItem("realEstateGameSave", JSON.stringify(saveData));
  setActiveSaveSlot(slot);
  setSaveSlotRefreshKey((current) => current + 1);
  setLog(`スロット${slot}に保存しました。`);
}

function applySaveDataToCurrentGame(data, slot) {
  if (!data || !Array.isArray(data.tiles)) {
    alert(`スロット${slot}のセーブデータを読み込めませんでした。`);
    return false;
  }

  const loadedCompanyName = data.playerCompanyName || DEFAULT_COMPANY_NAME;
  const loadedPlayerRank = data.playerRank ?? 1;
  const loadedPlayerExp = data.playerExp ?? 0;

  setActiveSaveSlot(slot);
  setPlayerCompanyName(loadedCompanyName);
  setNewCompanyNameInput(loadedCompanyName);
  setMoney(data.money ?? 20000);
  setLoans((data.loans ?? []).map(normalizeLoan));
  setPendingLoanApplications((data.pendingLoanApplications ?? []).map(normalizePendingLoanApplication));
  setPendingLoanConsultations((data.pendingLoanConsultations ?? []).map(normalizePendingLoanConsultation));
  setLoanConsultationReports((data.loanConsultationReports ?? []).map((report) => {
    return {
      ...report,
      expiresAtMonth: report?.expiresAtMonth ?? ((report?.resultMonth ?? data.month ?? 1) + 6),
    };
  }));
  setLoanAmountInput("5000");
  setSelectedBankId("regional");
  setConsultationApplicationAmounts({});
  setMonth(data.month ?? 1);
  setHqPlaced(Boolean(data.hqPlaced || data.tiles.some((tile) => tile.owner === OWNER.PLAYER && tile.feature === FEATURE.HQ)));
  setTiles(data.tiles);
  setSelectedId(data.selectedId ?? null);
  setLog(data.log ?? `スロット${slot}をロードしました。`);
  setLogHistory((data.logHistory ?? []).slice(0, 200));
  setPlayerRank(loadedPlayerRank);
  setPlayerExp(loadedPlayerExp);
  playerRankRef.current = loadedPlayerRank;
  playerExpRef.current = loadedPlayerExp;
  setEmployees((data.employees ?? [])
    .filter((employee) => employee.id !== 0)
    .map((employee) => normalizeEmployeeGrowthBase({
      ...employee,
      officeId: employee.officeId ?? "hq",
    })));
  setEmployeeCandidates(data.employeeCandidates ?? []);
  setEmployeeStorage((data.employeeStorage ?? [])
    .filter((employee) => employee.id !== 0)
    .map((employee) => normalizeEmployeeGrowthBase({
      ...employee,
      officeId: null,
    })));
  setActionPoints(data.actionPoints ?? 0);
  setEmployeeTickets(data.employeeTickets ?? 1);
  setPremiumEmployeeTickets(data.premiumEmployeeTickets ?? 0);
  setEmployeeSortKey(data.employeeSortKey ?? "rarity");
  setEmployeeSortDirection(data.employeeSortDirection ?? "desc");
  setAnnualStats(data.annualStats ?? { income: 0, maintenance: 0, tax: 0, purchase: 0, net: 0 });
  setMonthlyCompanyHistory(data.monthlyCompanyHistory ?? []);
  setAnnualReportHistory(data.annualReportHistory ?? []);
  setIsDemoMode(data.isDemoMode ?? false);
  setUsedSecretCommands(data.usedSecretCommands ?? {});
  setActivePanel(Boolean(data.hqPlaced || data.tiles.some((tile) => tile.owner === OWNER.PLAYER && tile.feature === FEATURE.HQ)) ? "home" : "hq");
  setIsMainMenuOpen(false);
  setSaveLoadModal(null);
  setTitleModal(null);
  setShowTitleScreen(false);
  setPopupLog(null);
  setAnnualReport(null);
  setPlayerRankUpResult(null);
  setTicketRewardResult(null);
  setSelectedCompanyDetail(null);
  setEmployeeGachaResult(null);
  setSelectedEmployeeDetail(null);
  setSelectedBuildCategory(null);
  setSelectedHousingType(null);
  setPendingBuildKey(null);
  setPendingBranchPlacement(false);

  const normalizedSaveData = {
    ...data,
    activeSaveSlot: slot,
    playerCompanyName: loadedCompanyName,
    savedAt: data.savedAt ?? new Date().toISOString(),
  };

  localStorage.setItem("realEstateGameCurrentSlot", String(slot));
  localStorage.setItem(getSaveSlotKey(slot), JSON.stringify(normalizedSaveData));
  localStorage.setItem("realEstateGameSave", JSON.stringify(normalizedSaveData));
  setSaveSlotRefreshKey((current) => current + 1);
  return true;
}

function loadSaveSlotFromTitle(slot) {
  const data = readSaveSlot(slot);
  if (!data) {
    alert(`スロット${slot}にセーブデータはありません。`);
    return;
  }

  const ok = window.confirm(`スロット${slot}をロードしますか？

現在の画面の未保存操作は上書きされます。`);
  if (!ok) return;

  const loaded = applySaveDataToCurrentGame(data, slot);
  if (loaded) {
    setLog(`スロット${slot}をロードしました。`);
  }
}

function startNewGameFromTitle(slot = activeSaveSlot) {
  const companyName = (newCompanyNameInput || DEFAULT_COMPANY_NAME).trim() || DEFAULT_COMPANY_NAME;
  const ok = window.confirm(`スロット${slot}で「${companyName}」として最初から始めますか？

このスロットの既存データは上書きされます。`);
  if (!ok) return;

  localStorage.setItem("realEstateGameCurrentSlot", String(slot));
  setActiveSaveSlot(slot);
  setPlayerCompanyName(companyName);
  setNewCompanyNameInput(companyName);
  setMoney(20000);
  setLoans([]);
  setPendingLoanApplications([]);
  setPendingLoanConsultations([]);
  setLoanConsultationReports([]);
  setLoanAmountInput("5000");
  setSelectedBankId("regional");
  setMonth(1);
  setPlayerRank(1);
  setPlayerExp(0);
  playerRankRef.current = 1;
  playerExpRef.current = 0;
  setPlayerRankUpResult(null);

  const newMap = createMap();
  setTiles(newMap.tiles);
  setSelectedId(null);
  setHqPlaced(false);
  setActivePanel("hq");
  setEmployees([]);
  setEmployeeCandidates([]);
  setEmployeeStorage([]);
  setActionPoints(0);
  setEmployeeTickets(1);
  setPremiumEmployeeTickets(0);
  setEmployeeSortKey("rarity");
  setEmployeeSortDirection("desc");
  setLogHistory([]);
  setPopupLog(null);
  setAnnualReport(null);
  setAnnualStats({ income: 0, maintenance: 0, tax: 0, purchase: 0, net: 0 });
  setMonthlyCompanyHistory([]);
  setAnnualReportHistory([]);
  setIsDemoMode(false);
  setUsedSecretCommands({});
  setShowTitleScreen(false);
  setTitleModal(null);
  setSaveLoadModal(null);
  setIsMainMenuOpen(false);
  setLog(`${companyName}として最初から開始しました。最初に本社を設置してください。`);
}

const hasSaveData = Boolean(savedGame) || hasAnySaveSlot;
const ownedBuildingCountForTitle = tiles.filter((tile) => {
  return tile.owner === OWNER.PLAYER && tile.building && !tile.buildingMainId;
}).length;
const titleTotalAssets = money + tiles.reduce((sum, tile) => {
  if (tile.owner !== OWNER.PLAYER) return sum;
  if (tile.buildingMainId) return sum;
  const buildingValue = tile.building ? Math.round((BUILDINGS[tile.building]?.cost ?? 0) * 0.65) : 0;
  return sum + (tile.landPrice ?? 0) + buildingValue;
}, 0);

function openGameFromTitle() {
  setShowTitleScreen(false);
  setTitleModal(null);
  setActivePanel(hqPlaced ? "home" : "hq");
  setMapViewMode("normal");
  setIsMainMenuOpen(false);
  setIsMoneyInfoOpen(false);
  setIsDateInfoOpen(false);
}

function returnToTitleScreen() {
  setShowTitleScreen(true);
  setTitleModal(null);
  setIsMainMenuOpen(false);
  setShowOptions(false);
  setIsMoneyInfoOpen(false);
  setIsDateInfoOpen(false);
}

function turnBgmOn() {
  setIsBgmOn(true);
}

function turnBgmOff() {
  setIsBgmOn(false);
}

const employeeLibraryRarityOptions = ["ALL", "N", "R", "HR", "SR", "SSR", "UR"];

const ownedEmployeeLibrary = Array.from(
  new Map(
    [
      ...employees.filter((employee) => employee.id !== 0),
      ...employeeStorage,
    ].map((employee) => [employee.id, employee])
  ).values()
);

const employeeLibraryCounts = ownedEmployeeLibrary.reduce((counts, employee) => {
  const rarity = employee.rarity ?? "N";
  return {
    ...counts,
    [rarity]: (counts[rarity] ?? 0) + 1,
  };
}, {});

const filteredEmployeeLibrary = employeeLibraryFilter === "ALL"
  ? ownedEmployeeLibrary
  : ownedEmployeeLibrary.filter((employee) => employee.rarity === employeeLibraryFilter);

const employeeLibraryCompletionRate = EMPLOYEE_POOL.length > 0
  ? Math.round((ownedEmployeeLibrary.length / EMPLOYEE_POOL.length) * 100)
  : 0;

return (
  <>
    <audio
      ref={bgmRef}
      src="/bgm/city.mp3"
      loop
    />

    <style>{`
      :root {
        --hk-bg: #f4f5f2;
        --hk-panel: #ffffff;
        --hk-panel-soft: #f8f8f5;
        --hk-ink: #202822;
        --hk-muted: #6d756f;
        --hk-line: #d7ddd5;
        --hk-accent: #1d5c3a;
        --hk-accent-dark: #123524;
        --hk-accent-soft: #e8f1eb;
        --hk-danger: #a33a32;
        --hk-warning: #b7791f;
        --hk-shadow: 0 12px 34px rgba(19, 32, 24, 0.12);
        --hk-radius: 18px;
      }

      .app {
        background: var(--hk-bg);
        color: var(--hk-ink);
      }

      .top-header.compact-top-header,
      .bottom-menu.compact-command-menu,
      .main-menu-popup,
      .side-section,
      .property-section,
      .log-section,
      .company-detail-box,
      .developer-command-box,
      .popup-log-card,
      .top-info-popup,
      .floating-panel,
      .land-detail-box,
      .building-detail-box,
      .employee-detail-card,
      .employee-action-select-card {
        background: rgba(255, 255, 255, 0.94) !important;
        color: var(--hk-ink) !important;
        border: 1px solid var(--hk-line) !important;
        border-radius: var(--hk-radius) !important;
        box-shadow: var(--hk-shadow) !important;
      }

      .top-header.compact-top-header {
        border-radius: 0 0 18px 18px !important;
      }

      .v73-title,
      .side-section h2,
      .side-section h3,
      .popup-log-card h2,
      .popup-log-card h3,
      .company-detail-box h3,
      .company-detail-box h4 {
        color: var(--hk-ink) !important;
        letter-spacing: 0.02em;
      }

      .side-section h2,
      .log-section h2,
      .property-section h2 {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--hk-accent-soft);
        border: 1px solid #cfe0d3;
        font-size: 18px;
      }

      .app button:not(.map-tile),
      .popup-log-card button,
      .main-menu-popup button,
      .side-section button,
      .developer-command-box button,
      .employee-action-select-button,
      .build-detail-button,
      .top-icon-button,
      .top-compact-stat-button,
      .table-sort-button {
        border-radius: 999px !important;
        border: 1px solid var(--hk-line) !important;
        background: linear-gradient(180deg, #ffffff 0%, #f2f5f1 100%) !important;
        color: var(--hk-ink) !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 12px rgba(19, 32, 24, 0.08) !important;
        transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease !important;
      }

      .app button:not(.map-tile):hover,
      .popup-log-card button:hover,
      .main-menu-popup button:hover,
      .side-section button:hover,
      .developer-command-box button:hover,
      .build-detail-button:hover,
      .top-icon-button:hover,
      .top-compact-stat-button:hover,
      .table-sort-button:hover {
        transform: translateY(-1px);
        border-color: #9eb8a5 !important;
        box-shadow: 0 8px 18px rgba(19, 32, 24, 0.14) !important;
      }

      .app button:not(.map-tile).active,
      .main-menu-popup button.active,
      .top-icon-button.active,
      .top-compact-stat-button.active,
      .employee-action-select-button.selected,
      .build-detail-button.active {
        background: linear-gradient(180deg, var(--hk-accent) 0%, var(--hk-accent-dark) 100%) !important;
        color: #ffffff !important;
        border-color: rgba(255,255,255,0.18) !important;
      }


      .employee-salary-note {
        margin: 6px 0 12px;
        padding: 8px 10px;
        border-radius: 12px;
        background: #fff8e6;
        border: 1px solid #ead59b;
        font-weight: 700;
      }

      .ticket-button-row {
        align-items: stretch !important;
      }

      .employee-ticket-button {
        position: relative !important;
        overflow: hidden !important;
        min-height: 54px !important;
        padding: 10px 18px !important;
        letter-spacing: 0.04em !important;
      }

      .employee-ticket-button::before {
        content: "";
        position: absolute;
        inset: -80%;
        background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.75) 50%, transparent 65%);
        transform: translateX(-55%);
        animation: ticketShine 2.8s ease-in-out infinite;
      }

      .normal-ticket-button {
        border: 2px solid #d7a64a !important;
        background: linear-gradient(135deg, #fff7d6 0%, #f4c96a 45%, #fff2b3 100%) !important;
        color: #553500 !important;
      }

      .premium-ticket-button {
        border: 2px solid rgba(255,255,255,0.75) !important;
        background: linear-gradient(120deg, #ff4ecd, #ff9a3d, #fff06a, #3bea7a, #30c4ff, #8d62ff, #ff4ecd) !important;
        background-size: 400% 400% !important;
        color: #ffffff !important;
        text-shadow: 0 2px 8px rgba(0,0,0,0.45) !important;
        animation: premiumRainbow 3.2s linear infinite;
      }

      .employee-ticket-button:disabled {
        animation: none !important;
        filter: grayscale(0.8);
        opacity: 0.65;
      }

      .employee-count-link-button {
        padding: 5px 10px !important;
        min-height: 30px !important;
      }

      .company-employee-list-card,
      .company-building-list-card {
        width: min(94vw, 980px) !important;
        max-height: 88vh;
        overflow: auto;
      }

      .company-employee-list-table th,
      .company-employee-list-table td {
        white-space: nowrap;
      }

      .gacha-ticket-animation {
        position: relative;
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
      }

      .gacha-ticket-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 62px;
        height: 62px;
        border-radius: 18px;
        font-size: 38px;
        background: linear-gradient(135deg, #fff3b0, #f5bd32);
        box-shadow: 0 10px 22px rgba(183, 121, 31, 0.28);
        animation: gachaTicketOpen 0.9s ease-out both;
      }

      .gacha-ticket-flash {
        position: absolute;
        font-size: 44px;
        animation: gachaFlash 1.2s ease-out both;
      }

      @keyframes ticketShine {
        0% { transform: translateX(-60%) rotate(8deg); }
        55% { transform: translateX(80%) rotate(8deg); }
        100% { transform: translateX(80%) rotate(8deg); }
      }

      @keyframes premiumRainbow {
        0% { background-position: 0% 50%; }
        100% { background-position: 400% 50%; }
      }

      @keyframes gachaTicketOpen {
        0% { transform: scale(0.5) rotate(-14deg); opacity: 0; }
        55% { transform: scale(1.12) rotate(8deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }

      @keyframes gachaFlash {
        0% { transform: scale(0.2); opacity: 0; }
        45% { transform: scale(1.45); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }

      .demo-money-add-button {
        min-width: 64px !important;
        width: auto !important;
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 10px !important;
        font-size: 13px !important;
        line-height: 1 !important;
        flex: 0 0 auto !important;
      }

      .top-status-inline .top-compact-stat {
        white-space: nowrap !important;
      }

      .v73-top-command-bar {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .v73-top-status-inline {
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 6px !important;
        flex: 0 1 auto !important;
        min-width: 0 !important;
        max-width: calc(100% - 136px) !important;
        overflow: visible !important;
      }

      .v73-top-status-inline .top-status-chip-wrap {
        flex: 0 0 auto !important;
        min-width: 0 !important;
      }

      .v73-top-status-inline .top-status-chip-wrap .top-compact-stat {
        width: auto !important;
        min-width: auto !important;
        max-width: none !important;
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 8px !important;
        font-size: 12px !important;
        line-height: 1 !important;
      }

      .v73-top-status-inline .demo-money-add-button,
      .app .v73-top-status-inline .demo-money-add-button,
      .app button.demo-money-add-button {
        width: 42px !important;
        min-width: 42px !important;
        max-width: 42px !important;
        height: 28px !important;
        min-height: 28px !important;
        padding: 0 !important;
        font-size: 11px !important;
        line-height: 1 !important;
        flex: 0 0 42px !important;
        overflow: hidden !important;
      }

      .app button:not(.map-tile):disabled,
      .side-section button:disabled,
      .top-icon-button:disabled,
      .build-detail-button:disabled {
        opacity: 0.46 !important;
        cursor: not-allowed !important;
        transform: none !important;
      }

      .side-section,
      .property-section,
      .log-section,
      .company-detail-box {
        padding: 16px !important;
      }

      .side-section section,
      .property-section,
      .log-section {
        background: rgba(255,255,255,0.72);
      }

      .table-scroll {
        border: 1px solid var(--hk-line) !important;
        border-radius: 16px !important;
        overflow: auto !important;
        background: #ffffff !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.75);
      }

      table,
      .property-table,
      .employee-detail-table {
        width: 100%;
        border-collapse: separate !important;
        border-spacing: 0 !important;
        background: #ffffff !important;
        color: var(--hk-ink) !important;
      }

      th,
      td {
        border-color: #e0e5de !important;
      }

      th {
        background: #eef3ef !important;
        color: #223126 !important;
        font-weight: 800 !important;
      }

      tr:nth-child(even) td {
        background: #fafbf8 !important;
      }

      .clickable-row:hover td {
        background: #edf6ee !important;
      }

      input,
      select,
      textarea {
        border: 1px solid var(--hk-line) !important;
        border-radius: 12px !important;
        background: #ffffff !important;
        color: var(--hk-ink) !important;
        padding: 9px 11px !important;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.04) !important;
      }

      .log-item,
      pre.log-item {
        background: #f7f8f4 !important;
        color: var(--hk-ink) !important;
        border: 1px solid var(--hk-line) !important;
        border-radius: 14px !important;
        padding: 12px !important;
      }

      .top-info-popup-grid,
      .employee-skill-item,
      .employee-action-select-button,
      .line-chart-box {
        background: #f8faf6 !important;
        border: 1px solid var(--hk-line) !important;
        border-radius: 16px !important;
      }

      .employee-action-select-button {
        border-radius: 16px !important;
        padding: 10px 12px !important;
        display: grid !important;
        gap: 4px !important;
        text-align: left !important;
      }

      .build-detail-button {
        border-radius: 18px !important;
        padding: 12px !important;
        text-align: left !important;
        background: linear-gradient(180deg, #ffffff 0%, #f8faf6 100%) !important;
      }

      .app .build-detail-popup .build-detail-buttons {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
        gap: 12px !important;
        align-items: stretch !important;
      }

      .app .build-detail-popup .build-detail-button {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        aspect-ratio: auto !important;
        border-radius: 12px !important;
        padding: 12px 14px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: flex-start !important;
        gap: 4px !important;
        text-align: left !important;
        white-space: normal !important;
        overflow: visible !important;
        line-height: 1.35 !important;
      }

      .app .build-detail-popup .build-detail-button strong {
        display: block !important;
        width: 100% !important;
        font-size: 15px !important;
        line-height: 1.35 !important;
        margin: 0 0 2px !important;
      }

      .app .build-detail-popup .build-detail-button span {
        display: block !important;
        width: 100% !important;
        font-size: 12px !important;
        line-height: 1.35 !important;
        overflow-wrap: anywhere !important;
      }

      .app .build-icon-menu {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(82px, 1fr)) !important;
        gap: 8px !important;
        margin-bottom: 10px !important;
      }

      .app .build-icon-button {
        min-height: 46px !important;
        padding: 7px 8px !important;
        border-radius: 14px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        line-height: 1.2 !important;
        font-size: 13px !important;
      }

      .app .build-icon-button .build-icon {
        font-size: 18px !important;
        line-height: 1 !important;
      }

      .main-menu-popup {
        padding: 12px !important;
      }

      .main-menu-popup button,
      .side-section > button,
      .log-section > button,
      .property-section > button {
        min-height: 38px;
      }


      .map-tile {
        border-radius: 5px !important;
        border: 1px solid rgba(35, 45, 36, 0.28) !important;
        color: #111827 !important;
        font-weight: 800 !important;
        box-shadow: none !important;
        transform: none !important;
        padding: 0 !important;
        min-height: 0 !important;
        line-height: 1 !important;
        overflow: hidden !important;
      }

      .map-tile:hover {
        transform: none !important;
        box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.68) !important;
        border-color: rgba(17, 24, 39, 0.45) !important;
      }

      .map-tile.selected {
        outline: 3px solid #ffcc00 !important;
        outline-offset: -3px !important;
        box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35) !important;
      }

      .map-tile.player-owned-tile {
        border-color: rgba(29, 92, 58, 0.9) !important;
        box-shadow: inset 0 0 0 2px rgba(29, 92, 58, 0.35) !important;
      }

      .map-tile.rival-company-a-tile {
        border-color: rgba(0, 188, 212, 0.95) !important;
        box-shadow: inset 0 0 0 3px rgba(0, 188, 212, 0.45) !important;
      }

      .map-tile.rival-company-b-tile {
        border-color: rgba(34, 197, 94, 0.95) !important;
        box-shadow: inset 0 0 0 3px rgba(34, 197, 94, 0.45) !important;
      }

      .map-tile.rival-company-c-tile {
        border-color: rgba(147, 51, 234, 0.98) !important;
        box-shadow: inset 0 0 0 3px rgba(147, 51, 234, 0.55) !important;
      }

      .map-tile.rival-company-a-range-tile {
        outline: 2px dashed rgba(0, 188, 212, 0.85) !important;
        outline-offset: -4px !important;
      }

      .map-tile.rival-company-b-range-tile {
        outline: 2px dashed rgba(34, 197, 94, 0.85) !important;
        outline-offset: -4px !important;
      }

      .map-tile.rival-company-c-range-tile {
        outline: 2px dashed rgba(147, 51, 234, 0.9) !important;
        outline-offset: -4px !important;
      }

      .map-tile.pending-build-target {
        outline: 3px solid #22c55e !important;
        outline-offset: -3px !important;
      }

      .map-grid .coord-header,
      .map-grid .coord-side,
      .map-grid .coord-top-left {
        border-radius: 4px !important;
      }

      .popup-log {
        backdrop-filter: blur(4px);
      }

      .popup-log-card {
        max-width: min(94vw, 720px);
      }

      .employee-recruitment-card {
        width: min(96vw, 1040px) !important;
        max-height: 90vh;
        overflow: auto;
        background:
          radial-gradient(circle at 14% 18%, rgba(255,255,255,0.72) 0 42px, transparent 43px),
          linear-gradient(135deg, #c39a6b 0%, #ad8358 44%, #8b6745 100%) !important;
        border: 3px solid rgba(92, 54, 22, 0.42) !important;
        box-shadow: 0 28px 80px rgba(0,0,0,0.42) !important;
        color: #2a1a0f !important;
        position: relative;
      }

      .employee-recruitment-card::before {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.28);
        pointer-events: none;
      }

      .employee-recruitment-card h2,
      .employee-recruitment-card p,
      .employee-recruitment-card .recruit-selected-detail,
      .employee-recruitment-card .recruit-required-note {
        position: relative;
        z-index: 1;
      }

      .recruit-envelope-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: repeat(5, minmax(130px, 1fr));
        gap: 18px;
        margin: 22px 0 18px;
        padding: 18px;
        border-radius: 24px;
        background:
          linear-gradient(90deg, rgba(255,255,255,0.08), transparent 28%, rgba(0,0,0,0.08)),
          rgba(68, 38, 18, 0.18);
      }

      .recruit-envelope-card {
        min-height: 250px !important;
        border-radius: 18px !important;
        padding: 10px 8px 12px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        white-space: normal !important;
        text-align: center !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        color: inherit !important;
        transform: rotate(-3deg);
        transition: transform 0.22s ease, filter 0.22s ease;
        animation: resumeEnvelopeDrop 0.46s ease both;
      }

      .recruit-envelope-card:nth-child(2) { transform: rotate(2deg); animation-delay: 0.06s; }
      .recruit-envelope-card:nth-child(3) { transform: rotate(-1deg); animation-delay: 0.12s; }
      .recruit-envelope-card:nth-child(4) { transform: rotate(3deg); animation-delay: 0.18s; }
      .recruit-envelope-card:nth-child(5) { transform: rotate(-2deg); animation-delay: 0.24s; }

      .recruit-envelope-card:hover,
      .recruit-envelope-card.selected {
        transform: translateY(-8px) rotate(0deg) scale(1.03);
        filter: brightness(1.05);
      }

      .recruit-envelope-card.selected .resume-envelope-visual {
        box-shadow: 0 0 0 4px rgba(255,214,92,0.88), 0 18px 34px rgba(0,0,0,0.32);
      }

      .recruit-envelope-card.opened .resume-envelope-flap {
        transform: rotateX(150deg);
      }

      .recruit-envelope-card.opened .resume-envelope-paper {
        transform: translateY(-58px);
        opacity: 1;
      }

      .recruit-envelope-number,
      .recruit-envelope-type {
        font-weight: 900;
        text-shadow: 0 1px 0 rgba(255,255,255,0.45);
      }

      .recruit-envelope-type {
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.74);
        border: 1px solid rgba(80,45,17,0.22);
      }

      .resume-envelope-visual {
        width: 132px;
        height: 172px;
        position: relative;
        display: block;
        border-radius: 9px;
        box-shadow: 0 14px 26px rgba(0,0,0,0.28);
        perspective: 700px;
      }

      .resume-envelope-back,
      .resume-envelope-body,
      .resume-envelope-flap {
        position: absolute;
        inset: 0;
        border-radius: 9px;
      }

      .resume-envelope-back {
        background: linear-gradient(135deg, #fffdf4, #ece3ca);
        border: 3px solid #d3c5a1;
      }

      .resume-envelope-body {
        background:
          linear-gradient(135deg, transparent 49%, rgba(0,0,0,0.12) 50%, transparent 51%),
          linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.36) 50%, transparent 51%),
          linear-gradient(180deg, rgba(255,255,255,0.4), rgba(0,0,0,0.06));
        border: 3px solid rgba(92, 63, 28, 0.22);
      }

      .resume-envelope-flap {
        clip-path: polygon(0 0, 100% 0, 50% 48%);
        transform-origin: top center;
        transition: transform 0.46s ease;
        background: linear-gradient(180deg, rgba(255,255,255,0.52), rgba(0,0,0,0.08));
        z-index: 4;
      }

      .resume-envelope-paper {
        position: absolute;
        left: 18px;
        top: 38px;
        width: 96px;
        height: 118px;
        border-radius: 4px;
        background: linear-gradient(180deg, #fffef8, #f0eadb);
        border: 2px solid #d6cab2;
        z-index: 2;
        transform: translateY(0);
        opacity: 0.92;
        transition: transform 0.46s ease, opacity 0.46s ease;
        display: grid;
        align-content: start;
        justify-items: center;
        gap: 9px;
        padding-top: 12px;
      }

      .resume-paper-title {
        font-size: 14px;
        font-weight: 900;
        color: #6b4b2b;
        letter-spacing: 0.1em;
      }

      .resume-paper-line {
        width: 68px;
        height: 5px;
        border-radius: 999px;
        background: #d8ccb7;
      }

      .resume-paper-line.short {
        width: 48px;
      }

      .resume-envelope-seal {
        position: absolute;
        left: 50%;
        top: 84px;
        transform: translateX(-50%);
        z-index: 5;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 900;
        font-family: serif;
        color: #6b3b00;
        background: radial-gradient(circle at 30% 25%, #fff2a6, #f0b21e 48%, #ad6d05 100%);
        border: 2px solid rgba(120,75,0,0.42);
        box-shadow: 0 3px 8px rgba(0,0,0,0.28);
      }

      .resume-envelope-shine {
        position: absolute;
        inset: -12px;
        pointer-events: none;
        opacity: 0;
        background:
          radial-gradient(circle at 14% 18%, rgba(255,255,255,0.95) 0 3px, transparent 4px),
          radial-gradient(circle at 85% 30%, rgba(255,255,255,0.9) 0 3px, transparent 4px),
          radial-gradient(circle at 62% 82%, rgba(255,255,255,0.8) 0 2px, transparent 3px);
        animation: resumeSparkle 1.7s ease-in-out infinite;
      }

      .recruit-envelope-card.envelope-white .resume-envelope-back {
        background: linear-gradient(135deg, #fffdf6, #eee5ce);
        border-color: #d7c9aa;
      }

      .recruit-envelope-card.envelope-brown .resume-envelope-back {
        background: linear-gradient(135deg, #9b5e25, #5d3212 70%, #3e210c);
        border-color: #e7b65d;
      }

      .recruit-envelope-card.envelope-brown .resume-envelope-body,
      .recruit-envelope-card.envelope-brown .resume-envelope-flap {
        border-color: rgba(255,230,151,0.5);
        background:
          linear-gradient(135deg, transparent 49%, rgba(0,0,0,0.22) 50%, transparent 51%),
          linear-gradient(180deg, rgba(255,223,141,0.18), rgba(0,0,0,0.22));
      }

      .recruit-envelope-card.envelope-brown .recruit-envelope-type {
        color: #5d3212;
        background: #ffe3a5;
      }

      .recruit-envelope-card.envelope-black .resume-envelope-back {
        background: linear-gradient(135deg, #20152a, #08070b 70%, #000000);
        border-color: #e8c85f;
      }

      .recruit-envelope-card.envelope-black .resume-envelope-body,
      .recruit-envelope-card.envelope-black .resume-envelope-flap {
        border-color: rgba(255,227,112,0.78);
        background:
          linear-gradient(135deg, transparent 49%, rgba(255,224,99,0.14) 50%, transparent 51%),
          linear-gradient(180deg, rgba(255,230,121,0.18), rgba(0,0,0,0.48));
      }

      .recruit-envelope-card.envelope-black .resume-envelope-shine {
        opacity: 1;
      }

      .recruit-envelope-card.envelope-black .recruit-envelope-type {
        color: #211500;
        background: #f6dc77;
      }

      .recruit-applicant-summary {
        display: grid;
        gap: 4px;
        font-size: 13px;
        line-height: 1.35;
        min-height: 58px;
        align-content: center;
      }

      .opened-summary {
        padding: 8px;
        border-radius: 12px;
        background: rgba(255,255,255,0.78);
        color: #23170e;
      }

      .recruit-selected-detail {
        margin-top: 12px;
        padding: 12px;
        border-radius: 16px;
        border: 1px solid rgba(92, 54, 22, 0.28);
        background: rgba(255, 250, 235, 0.92);
      }

      .recruit-required-note {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.72);
        font-weight: 800;
      }

      @keyframes resumeEnvelopeDrop {
        from { opacity: 0; transform: translateY(-26px) rotate(-8deg) scale(0.96); }
        to { opacity: 1; }
      }

      @keyframes resumeSparkle {
        0%, 100% { opacity: 0.25; transform: scale(0.98); }
        50% { opacity: 1; transform: scale(1.03); }
      }

      @media (max-width: 900px) {
        .recruit-envelope-grid {
          grid-template-columns: repeat(2, minmax(130px, 1fr));
        }
      }



      /* v114 採用画面調整：開封前NEW表示、封止めのN削除、上部小物削除 */
      .recruit-paper-stack,
      .recruit-ledger-book {
        display: none !important;
      }

      .resume-envelope-seal {
        font-size: 0 !important;
      }

      .resume-seal-emblem {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        font-size: 18px;
        line-height: 1;
        color: rgba(93, 51, 3, 0.7);
        text-shadow: 0 1px 0 rgba(255,255,255,0.35);
        transform: rotate(45deg);
      }

      .recruit-envelope-card.envelope-brown .resume-seal-emblem,
      .recruit-envelope-card.envelope-black .resume-seal-emblem {
        color: rgba(255, 224, 185, 0.88);
      }

      .recruit-envelope-card.closed .envelope-new-stamp {
        top: 10px;
        right: -12px;
        transform: rotate(-7deg) scale(0.95);
      }

      .recruit-envelope-card.opened .envelope-new-stamp {
        top: 18px;
        right: -8px;
      }

      .employee-awakening-result {
        font-weight: 900;
        color: #b7791f;
      }

      @media (max-width: 640px) {
        .side-section,
        .property-section,
        .log-section,
        .company-detail-box {
          padding: 12px !important;
          border-radius: 16px !important;
        }

        .app button:not(.map-tile),
        .side-section button,
        .main-menu-popup button {
          min-height: 40px;
        }
      }


      .recruit-popup-stage {
        background: rgba(8, 5, 2, 0.68) !important;
        backdrop-filter: blur(6px);
      }

      .employee-recruitment-card.recruit-desk-card {
        width: min(98vw, 1180px) !important;
        max-height: 94vh;
        overflow: auto;
        padding: 22px 24px 18px !important;
        color: #fff7d5 !important;
        background:
          radial-gradient(circle at 16% 24%, rgba(255, 223, 143, 0.32), transparent 21%),
          radial-gradient(circle at 82% 33%, rgba(255, 216, 102, 0.18), transparent 28%),
          linear-gradient(180deg, rgba(88, 49, 20, 0.55), rgba(35, 17, 8, 0.88)),
          repeating-linear-gradient(90deg, #5b3219 0 20px, #63391e 21px 42px, #4a2815 43px 66px) !important;
        border: 2px solid rgba(255, 220, 126, 0.42) !important;
        box-shadow: 0 30px 110px rgba(0,0,0,0.7), inset 0 0 120px rgba(255, 205, 83, 0.14) !important;
      }

      .employee-recruitment-card.recruit-desk-card::before {
        border: 1px solid rgba(255, 223, 139, 0.22);
        box-shadow: inset 0 0 70px rgba(255, 220, 126, 0.11);
      }

      .recruit-title-area {
        position: relative;
        z-index: 3;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 14px;
        text-align: center;
        margin-bottom: 10px;
      }

      .recruit-title-area h2 {
        margin: 0 !important;
        font-size: clamp(30px, 5vw, 54px);
        letter-spacing: 0.16em;
        color: #ffe999 !important;
        text-shadow: 0 4px 0 rgba(50, 22, 4, 0.8), 0 0 20px rgba(255, 219, 88, 0.45);
      }

      .recruit-title-area p {
        grid-column: 1 / -1;
        margin: -4px 0 0 !important;
        color: #ffffff !important;
        font-size: clamp(14px, 2.4vw, 20px);
        text-shadow: 0 2px 8px rgba(0,0,0,0.7);
      }

      .recruit-ornament {
        color: #e7c65e;
        opacity: 0.9;
        font-size: 22px;
      }

      .recruit-desk-decoration {
        position: absolute;
        pointer-events: none;
        z-index: 0;
      }

      .recruit-paper-stack {
        left: 22px;
        top: 24px;
        width: 160px;
        height: 86px;
        transform: rotate(-11deg);
        border-radius: 6px;
        background: linear-gradient(135deg, rgba(255,250,222,0.94), rgba(211,187,141,0.78));
        color: rgba(72, 45, 23, 0.58);
        font-weight: 900;
        display: grid;
        place-items: center;
        box-shadow: 0 12px 24px rgba(0,0,0,0.22);
      }

      .recruit-ledger-book {
        right: 26px;
        top: 20px;
        width: 154px;
        height: 70px;
        transform: rotate(5deg);
        border-radius: 8px;
        background: linear-gradient(135deg, #572319, #8b3a24 55%, #3a160e);
        border: 2px solid rgba(232, 188, 87, 0.48);
        color: rgba(255, 224, 134, 0.72);
        font-weight: 900;
        display: grid;
        place-items: center;
        letter-spacing: 0.28em;
      }

      .recruit-ink-bottle {
        right: 216px;
        top: 34px;
        width: 44px;
        height: 52px;
        border-radius: 9px 9px 14px 14px;
        background: linear-gradient(180deg, #0b0b0d, #202027 45%, #050506);
        box-shadow: inset 0 4px 0 rgba(255,255,255,0.18), 0 10px 22px rgba(0,0,0,0.35);
      }

      .recruit-pen {
        right: 302px;
        top: 60px;
        width: 178px;
        height: 10px;
        transform: rotate(-8deg);
        border-radius: 999px;
        background: linear-gradient(90deg, #d8b85a 0 12%, #111 13% 68%, #e5c66e 69% 74%, #151515 75%);
        box-shadow: 0 8px 18px rgba(0,0,0,0.32);
      }

      .recruit-sparkle {
        position: absolute;
        z-index: 2;
        color: #fff8c8;
        text-shadow: 0 0 16px #fff, 0 0 28px #ffd55a;
        animation: recruitTwinkle 1.8s ease-in-out infinite;
        pointer-events: none;
      }

      .sparkle-a { left: 18%; top: 23%; font-size: 24px; }
      .sparkle-b { left: 45%; top: 21%; font-size: 18px; animation-delay: 0.4s; }
      .sparkle-c { right: 18%; top: 28%; font-size: 26px; animation-delay: 0.8s; }
      .sparkle-d { right: 9%; top: 52%; font-size: 20px; animation-delay: 1.2s; }

      .recruit-envelope-desk-row {
        display: flex !important;
        grid-template-columns: none !important;
        justify-content: center;
        align-items: flex-end;
        gap: clamp(10px, 1.6vw, 20px) !important;
        margin: 20px 0 10px !important;
        padding: 26px 12px 14px !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
      }

      .recruit-envelope-card {
        width: clamp(118px, 15.3vw, 178px);
        min-height: clamp(178px, 23vw, 254px);
        padding: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        overflow: visible !important;
        color: #fff !important;
        transform-origin: center bottom;
      }

      .recruit-envelope-card:nth-child(1) { transform: rotate(-5deg); }
      .recruit-envelope-card:nth-child(2) { transform: rotate(-2deg); }
      .recruit-envelope-card:nth-child(3) { transform: rotate(1deg); }
      .recruit-envelope-card:nth-child(4) { transform: rotate(4deg); }
      .recruit-envelope-card:nth-child(5) { transform: rotate(6deg); }

      .recruit-envelope-card:hover,
      .recruit-envelope-card.selected {
        transform: translateY(-12px) scale(1.05) rotate(0deg) !important;
      }

      .recruit-envelope-card.selected .resume-envelope-visual {
        filter: drop-shadow(0 0 18px rgba(255, 236, 155, 0.95)) drop-shadow(0 20px 22px rgba(0,0,0,0.46));
      }

      .recruit-envelope-card .resume-envelope-visual {
        width: 100% !important;
        height: clamp(160px, 22vw, 230px) !important;
        filter: drop-shadow(0 18px 18px rgba(0,0,0,0.35)) drop-shadow(0 0 15px rgba(255, 220, 93, 0.55));
      }

      .resume-envelope-logo {
        position: absolute;
        left: 50%;
        bottom: 20px;
        transform: translateX(-50%);
        z-index: 5;
        font-size: 10px;
        line-height: 1.05;
        font-weight: 900;
        letter-spacing: 0.04em;
        color: rgba(70, 48, 28, 0.74);
        text-align: center;
      }

      .recruit-envelope-card.envelope-black .resume-envelope-logo,
      .recruit-envelope-card.envelope-brown .resume-envelope-logo {
        color: rgba(229, 196, 113, 0.78);
      }

      .recruit-envelope-card .resume-envelope-seal {
        background: radial-gradient(circle at 35% 30%, #ffef9c, #c68109 68%, #7b3300) !important;
        color: rgba(71, 34, 0, 0.74) !important;
        box-shadow: inset 0 2px 4px rgba(255,255,255,0.45), 0 0 12px rgba(255, 190, 52, 0.6) !important;
      }

      .recruit-envelope-card.envelope-brown .resume-envelope-seal,
      .recruit-envelope-card.envelope-black .resume-envelope-seal {
        background: radial-gradient(circle at 35% 30%, #ff8a78, #bd1e12 66%, #5c0703) !important;
        color: rgba(255, 223, 185, 0.9) !important;
      }

      .recruit-envelope-number,
      .recruit-envelope-type {
        display: none !important;
      }

      .recruit-envelope-card .recruit-applicant-summary {
        margin-top: 10px;
        min-height: 0 !important;
        color: #fff6c2;
        font-size: 12px;
        font-weight: 900;
        text-shadow: 0 2px 8px rgba(0,0,0,0.7);
      }

      .recruit-new-stamp {
        display: inline-grid;
        place-items: center;
        padding: 4px 10px;
        border: 3px solid #ff5572;
        border-radius: 4px;
        background: #fff1f3;
        color: #e02949;
        font-weight: 1000;
        letter-spacing: 0.04em;
        box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        transform: rotate(-7deg);
      }

      .envelope-new-stamp {
        position: absolute;
        z-index: 10;
        top: 18px;
        right: -8px;
        font-size: 16px;
      }

      .profile-new-stamp {
        position: absolute;
        left: -14px;
        top: -14px;
        z-index: 4;
        font-size: 20px;
      }

      .recruit-tap-guide {
        position: relative;
        z-index: 3;
        width: fit-content;
        margin: 2px auto 12px;
        padding: 8px 38px;
        border-top: 1px solid rgba(255, 226, 137, 0.42);
        border-bottom: 1px solid rgba(255, 226, 137, 0.42);
        color: #fffdf2;
        font-weight: 900;
        text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      }

      .recruit-profile-wrap {
        position: relative;
        z-index: 3;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 18px;
        margin-top: 8px;
      }

      .recruit-profile-panel {
        position: relative;
        z-index: 3;
        display: grid;
        grid-template-columns: 230px minmax(0, 1fr);
        gap: 18px;
        padding: 18px;
        border-radius: 10px;
        color: #26180d;
        background:
          linear-gradient(135deg, rgba(255,255,255,0.78), transparent 32%),
          linear-gradient(180deg, #fff9e8, #ead7b6) !important;
        border: 2px solid rgba(125, 85, 34, 0.48);
        box-shadow: 0 16px 30px rgba(0,0,0,0.34), inset 0 0 0 3px rgba(255,255,255,0.35);
      }

      .recruit-profile-empty {
        display: block;
        text-align: center;
        margin: 10px auto 0;
        width: min(720px, 92%);
      }

      .recruit-profile-empty-title {
        font-size: 20px;
        font-weight: 1000;
      }

      .recruit-profile-photo {
        position: relative;
        min-height: 238px;
        display: grid;
        place-items: center;
      }

      .recruit-avatar {
        width: 210px;
        height: 230px;
        border-radius: 8px;
        border: 4px solid #f8f1dd;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 50% 25%, rgba(255,255,255,0.85), transparent 22%),
          linear-gradient(135deg, #9fc1ff, #f0e6ff 55%, #4d3578);
        box-shadow: inset 0 0 60px rgba(255,255,255,0.3), 0 10px 18px rgba(0,0,0,0.22);
      }

      .recruit-avatar-male {
        background:
          radial-gradient(circle at 50% 25%, rgba(255,255,255,0.85), transparent 22%),
          linear-gradient(135deg, #92b8ff, #d9e8ff 55%, #28466f);
      }

      .recruit-avatar span {
        width: 88px;
        height: 88px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: rgba(255,255,255,0.78);
        font-size: 54px;
        font-weight: 1000;
        color: #3a2850;
        box-shadow: 0 8px 20px rgba(0,0,0,0.18);
      }

      .recruit-profile-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid rgba(92, 55, 22, 0.22);
        padding-bottom: 8px;
      }

      .recruit-profile-header h3 {
        margin: 0;
        font-size: clamp(24px, 3.6vw, 38px);
        color: #1d1209;
      }

      .recruit-job-and-stars {
        display: grid;
        justify-items: end;
        gap: 4px;
        white-space: nowrap;
      }

      .recruit-job-badge {
        padding: 5px 10px;
        border-radius: 7px;
        background: linear-gradient(135deg, #b63b35, #7e1d19);
        color: #fff4d8;
        font-weight: 900;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.18);
      }

      .employee-rarity-stars {
        font-size: 24px;
        letter-spacing: 1px;
        text-shadow: 0 2px 0 rgba(80, 42, 0, 0.42);
      }

      .employee-star.filled { color: #f5b91f; }
      .employee-star.empty { color: #9f9a8c; }

      .recruit-profile-subrow {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
        margin: 10px 0;
        font-weight: 900;
      }

      .recruit-stat-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(120px, 1fr));
        gap: 8px;
      }

      .recruit-stat-grid div {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 9px 11px;
        border-radius: 8px;
        background: rgba(255,255,255,0.54);
        border: 1px solid rgba(99, 60, 25, 0.14);
      }

      .recruit-stat-grid span {
        font-weight: 900;
        color: #644220;
      }

      .recruit-stat-grid strong {
        font-size: 18px;
      }

      .recruit-special-box {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(255,255,255,0.62);
        border: 1px solid rgba(99, 60, 25, 0.18);
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .recruit-special-box span {
        padding: 4px 10px;
        border-radius: 6px;
        background: #8458a5;
        color: #ffffff;
        font-weight: 900;
      }

      .recruit-hire-side {
        display: grid;
        justify-items: center;
        gap: 10px;
      }

      .recruit-hire-button {
        min-width: 220px;
        min-height: 70px;
        border-radius: 12px;
        border: 3px solid #e7c76a;
        background: linear-gradient(180deg, #16a65a, #066d35) !important;
        color: #fff9d8 !important;
        font-size: 20px;
        font-weight: 1000;
        box-shadow: 0 0 0 3px rgba(11, 62, 30, 0.75), 0 0 24px rgba(255, 224, 105, 0.58), 0 14px 22px rgba(0,0,0,0.34);
      }

      .recruit-hire-side p {
        margin: 0 !important;
        color: #fff !important;
        font-weight: 900;
        text-shadow: 0 2px 8px rgba(0,0,0,0.72);
      }

      .recruit-required-note-fantasy {
        position: relative;
        z-index: 3;
        width: fit-content;
        margin: 12px auto 0 !important;
        color: #fff7cf !important;
        background: rgba(0,0,0,0.28) !important;
        border: 1px solid rgba(255,226,137,0.22);
      }

      @keyframes recruitTwinkle {
        0%, 100% { opacity: 0.28; transform: scale(0.7) rotate(0deg); }
        50% { opacity: 1; transform: scale(1.25) rotate(18deg); }
      }

      @media (max-width: 900px) {
        .recruit-envelope-desk-row {
          flex-wrap: wrap;
        }

        .recruit-profile-wrap {
          grid-template-columns: 1fr;
        }

        .recruit-profile-panel {
          grid-template-columns: 1fr;
        }

        .recruit-profile-photo {
          min-height: 190px;
        }

        .recruit-avatar {
          width: 170px;
          height: 180px;
        }

        .recruit-stat-grid {
          grid-template-columns: repeat(2, minmax(120px, 1fr));
        }
      }

      @media (max-width: 560px) {
        .employee-recruitment-card.recruit-desk-card {
          padding: 14px 12px !important;
        }

        .recruit-paper-stack,
        .recruit-ledger-book,
        .recruit-ink-bottle,
        .recruit-pen {
          display: none;
        }

        .recruit-envelope-card {
          width: 122px;
          min-height: 170px;
        }

        .recruit-envelope-card .resume-envelope-visual {
          height: 150px !important;
        }

        .recruit-stat-grid {
          grid-template-columns: 1fr;
        }

        .recruit-profile-header {
          display: grid;
        }

        .recruit-job-and-stars {
          justify-items: start;
        }
      }


      /* v112 採用画面レイアウト調整：星表記廃止、レア度テキスト化、履歴書横長化 */
      .employee-recruitment-card.recruit-desk-card {
        width: min(96vw, 1380px) !important;
        max-height: 96vh !important;
        overflow-x: hidden !important;
        padding: clamp(16px, 1.8vw, 26px) clamp(16px, 2.4vw, 34px) 22px !important;
      }

      .recruit-title-area {
        margin-bottom: 4px !important;
      }

      .recruit-envelope-desk-row {
        gap: clamp(16px, 2.2vw, 34px) !important;
        padding: 30px 10px 12px !important;
        margin: 12px 0 4px !important;
      }

      .recruit-envelope-card {
        width: clamp(135px, 13vw, 184px) !important;
        min-height: clamp(188px, 19vw, 252px) !important;
      }

      .recruit-envelope-card:nth-child(1),
      .recruit-envelope-card:nth-child(2),
      .recruit-envelope-card:nth-child(3),
      .recruit-envelope-card:nth-child(4),
      .recruit-envelope-card:nth-child(5) {
        transform: rotate(0deg) !important;
      }

      .recruit-envelope-card:hover,
      .recruit-envelope-card.selected {
        transform: translateY(-10px) scale(1.045) !important;
      }

      .recruit-envelope-card .resume-envelope-visual {
        height: clamp(178px, 18vw, 244px) !important;
      }

      .recruit-profile-wrap {
        grid-template-columns: minmax(0, 1fr) clamp(190px, 18vw, 260px) !important;
        align-items: center !important;
        gap: clamp(16px, 2vw, 28px) !important;
        margin-top: 10px !important;
      }

      .recruit-profile-panel {
        grid-template-columns: clamp(220px, 20vw, 300px) minmax(0, 1fr) !important;
        gap: clamp(18px, 2vw, 28px) !important;
        padding: clamp(16px, 1.8vw, 24px) !important;
        min-height: 260px;
      }

      .recruit-profile-photo {
        min-height: 240px !important;
      }

      .recruit-avatar {
        width: clamp(190px, 18vw, 260px) !important;
        height: clamp(205px, 20vw, 280px) !important;
      }

      .recruit-profile-header {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 18px !important;
      }

      .recruit-profile-header h3 {
        font-size: clamp(28px, 3.2vw, 44px) !important;
        line-height: 1.12 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .recruit-job-and-stars {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        white-space: nowrap !important;
      }

      .employee-rarity-stars {
        display: none !important;
      }

      .employee-rarity-label {
        min-width: 58px;
        padding: 2px 6px;
        text-align: center;
        font-family: Georgia, "Times New Roman", serif;
        font-size: clamp(28px, 3.2vw, 42px);
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0.02em;
        color: #8f1f1a;
        text-shadow: 0 1px 0 rgba(255, 242, 190, 0.86), 0 0 12px rgba(189, 48, 36, 0.22);
      }

      .employee-rarity-label.rarity-label-n {
        color: #5d4a36;
        font-size: clamp(24px, 2.8vw, 36px);
      }

      .employee-rarity-label.rarity-label-r {
        color: #2e6b9f;
        font-size: clamp(25px, 2.9vw, 38px);
      }

      .employee-rarity-label.rarity-label-hr {
        color: #8f1f1a;
      }

      .employee-rarity-label.rarity-label-sr {
        color: #b77416;
      }

      .employee-rarity-label.rarity-label-ssr,
      .employee-rarity-label.rarity-label-ur,
      .employee-rarity-label.rarity-label-社長 {
        color: #d5a21f;
        text-shadow: 0 1px 0 #3b1800, 0 0 14px rgba(255, 220, 82, 0.72);
      }

      .recruit-profile-subrow {
        border-bottom: 1px solid rgba(92, 55, 22, 0.18);
        padding-bottom: 8px;
      }

      .recruit-stat-grid {
        grid-template-columns: repeat(2, minmax(150px, 1fr)) !important;
        gap: 10px 14px !important;
      }

      .recruit-special-box {
        min-height: 54px;
      }

      .recruit-hire-button {
        width: 100% !important;
        min-width: 190px !important;
        min-height: 76px !important;
        font-size: clamp(17px, 1.8vw, 22px) !important;
      }

      .recruit-hire-side {
        align-self: center !important;
      }

      @media (max-width: 980px) {
        .recruit-profile-wrap {
          grid-template-columns: 1fr !important;
        }

        .recruit-hire-side {
          width: 100% !important;
        }

        .recruit-hire-button {
          width: min(100%, 420px) !important;
        }
      }

      @media (max-width: 760px) {
        .recruit-profile-panel {
          grid-template-columns: 1fr !important;
        }

        .recruit-profile-header {
          grid-template-columns: 1fr !important;
        }

        .recruit-profile-header h3 {
          white-space: normal !important;
        }

        .recruit-job-and-stars {
          justify-content: flex-start !important;
        }
      }


      /* v114 採用画面レイアウト再調整：横長UI固定、はみ出し防止 */
      .popup-log.recruit-popup-stage {
        align-items: center !important;
        justify-content: center !important;
        padding: 18px !important;
        overflow: auto !important;
      }

      .popup-log.recruit-popup-stage .popup-log-card.employee-recruitment-card.recruit-desk-card {
        width: min(96vw, 1180px) !important;
        min-width: min(96vw, 980px) !important;
        max-width: none !important;
        max-height: 94vh !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 22px 30px 20px !important;
      }

      .popup-log.recruit-popup-stage .recruit-title-area {
        grid-template-columns: 1fr auto 1fr !important;
        margin-bottom: 6px !important;
      }

      .popup-log.recruit-popup-stage .recruit-title-area h2 {
        white-space: nowrap !important;
        font-size: clamp(34px, 3.8vw, 54px) !important;
      }

      .popup-log.recruit-popup-stage .recruit-envelope-desk-row {
        display: flex !important;
        flex-wrap: nowrap !important;
        justify-content: center !important;
        align-items: flex-end !important;
        gap: clamp(14px, 1.8vw, 24px) !important;
        margin: 14px 0 6px !important;
        padding: 22px 8px 10px !important;
      }

      .popup-log.recruit-popup-stage .recruit-envelope-card {
        flex: 0 0 clamp(130px, 14.2vw, 174px) !important;
        width: clamp(130px, 14.2vw, 174px) !important;
        min-width: 0 !important;
        min-height: clamp(178px, 19vw, 232px) !important;
      }

      .popup-log.recruit-popup-stage .recruit-envelope-card .resume-envelope-visual {
        width: 100% !important;
        height: clamp(166px, 18.4vw, 226px) !important;
      }

      .popup-log.recruit-popup-stage .recruit-applicant-summary {
        font-size: 11px !important;
        line-height: 1.15 !important;
        white-space: nowrap !important;
      }

      .popup-log.recruit-popup-stage .recruit-tap-guide {
        margin: 0 auto 10px !important;
        padding: 7px 34px !important;
        font-size: 14px !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-wrap {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 230px !important;
        align-items: center !important;
        gap: 22px !important;
        width: 100% !important;
        margin-top: 8px !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-panel {
        display: grid !important;
        grid-template-columns: 250px minmax(0, 1fr) !important;
        align-items: stretch !important;
        gap: 20px !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 250px !important;
        box-sizing: border-box !important;
        padding: 18px 20px !important;
        overflow: visible !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-photo {
        position: relative !important;
        min-height: 230px !important;
        width: 250px !important;
        max-width: 250px !important;
        display: grid !important;
        place-items: center !important;
      }

      .popup-log.recruit-popup-stage .recruit-avatar {
        width: 210px !important;
        height: 220px !important;
        min-width: 210px !important;
        min-height: 220px !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-main {
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-header {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) auto !important;
        align-items: center !important;
        gap: 16px !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-header h3 {
        writing-mode: horizontal-tb !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
        font-size: clamp(26px, 3vw, 40px) !important;
        line-height: 1.15 !important;
      }

      .popup-log.recruit-popup-stage .recruit-job-and-stars {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        white-space: nowrap !important;
      }

      .popup-log.recruit-popup-stage .employee-rarity-stars {
        display: none !important;
      }

      .popup-log.recruit-popup-stage .employee-rarity-label {
        display: inline-block !important;
        min-width: 64px !important;
        text-align: center !important;
        font-size: clamp(28px, 3.2vw, 42px) !important;
        line-height: 1 !important;
      }

      .popup-log.recruit-popup-stage .recruit-profile-subrow {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px 18px !important;
        margin: 10px 0 !important;
        white-space: nowrap !important;
      }

      .popup-log.recruit-popup-stage .recruit-stat-grid {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(118px, 1fr)) !important;
        gap: 8px !important;
      }

      .popup-log.recruit-popup-stage .recruit-stat-grid div {
        min-width: 0 !important;
        padding: 8px 10px !important;
      }

      .popup-log.recruit-popup-stage .recruit-special-box {
        min-height: 50px !important;
        overflow-wrap: anywhere !important;
      }

      .popup-log.recruit-popup-stage .recruit-hire-side {
        width: 230px !important;
        align-self: center !important;
        display: grid !important;
        justify-items: center !important;
      }

      .popup-log.recruit-popup-stage .recruit-hire-button {
        width: 220px !important;
        min-width: 220px !important;
        min-height: 72px !important;
        font-size: 19px !important;
        white-space: nowrap !important;
      }

      .popup-log.recruit-popup-stage .recruit-hire-side p {
        font-size: 13px !important;
        line-height: 1.35 !important;
        text-align: center !important;
      }

      .popup-log.recruit-popup-stage .recruit-required-note-fantasy {
        margin-top: 10px !important;
        font-size: 13px !important;
      }

      @media (max-width: 1050px) {
        .popup-log.recruit-popup-stage .popup-log-card.employee-recruitment-card.recruit-desk-card {
          min-width: 0 !important;
          width: 96vw !important;
        }

        .popup-log.recruit-popup-stage .recruit-profile-wrap {
          grid-template-columns: 1fr !important;
        }

        .popup-log.recruit-popup-stage .recruit-hire-side {
          width: 100% !important;
        }

        .popup-log.recruit-popup-stage .recruit-hire-button {
          width: min(100%, 360px) !important;
        }
      }

      @media (max-width: 760px) {
        .popup-log.recruit-popup-stage .recruit-envelope-desk-row {
          overflow-x: auto !important;
          justify-content: flex-start !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        .popup-log.recruit-popup-stage .recruit-envelope-card {
          flex-basis: 132px !important;
          width: 132px !important;
        }

        .popup-log.recruit-popup-stage .recruit-profile-panel {
          grid-template-columns: 1fr !important;
        }

        .popup-log.recruit-popup-stage .recruit-profile-photo {
          width: 100% !important;
          max-width: none !important;
        }

        .popup-log.recruit-popup-stage .recruit-profile-header {
          grid-template-columns: 1fr !important;
        }

        .popup-log.recruit-popup-stage .recruit-job-and-stars {
          justify-content: flex-start !important;
        }

        .popup-log.recruit-popup-stage .recruit-stat-grid {
          grid-template-columns: repeat(2, minmax(110px, 1fr)) !important;
        }
      }

    `}</style>

    <style>{`
      /* v115 最終調整：開封前NEW、無文字の封ろう、上部小物削除、質感強化 */
      .recruit-paper-stack,
      .recruit-ledger-book {
        display: none !important;
      }

      .recruit-envelope-card.closed .envelope-new-stamp,
      .recruit-envelope-card.opened .envelope-new-stamp {
        display: inline-grid !important;
        top: 8px !important;
        right: -10px !important;
        transform: rotate(-7deg) scale(0.95) !important;
      }

      .recruit-envelope-card .resume-envelope-seal {
        font-size: 0 !important;
        overflow: hidden !important;
      }

      .recruit-envelope-card .resume-seal-emblem {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        font-size: 0 !important;
        color: transparent !important;
        transform: none !important;
      }

      .recruit-envelope-card .resume-seal-emblem::before {
        content: "✿";
        position: absolute;
        left: 50%;
        top: 50%;
        width: 24px;
        height: 24px;
        transform: translate(-50%, -50%);
        display: grid;
        place-items: center;
        border-radius: 999px;
        background:
          radial-gradient(circle at 35% 28%, rgba(255,255,255,0.42), transparent 30%),
          radial-gradient(circle at 50% 50%, rgba(166, 32, 43, 0.96), rgba(96, 18, 32, 0.98));
        color: rgba(255, 224, 185, 0.92);
        font-size: 14px;
        line-height: 1;
        box-shadow:
          inset 0 2px 5px rgba(255,255,255,0.25),
          inset 0 -4px 7px rgba(0,0,0,0.28),
          0 2px 5px rgba(0,0,0,0.25);
        filter: drop-shadow(0 1px 0 rgba(255,255,255,0.25));
      }

      .recruit-envelope-card.envelope-brown .resume-seal-emblem::before,
      .recruit-envelope-card.envelope-black .resume-seal-emblem::before {
        color: rgba(255, 224, 185, 0.88);
      }

      .recruit-envelope-card .resume-envelope-paper {
        transform: translateY(-10px) !important;
        opacity: 0.98 !important;
      }

      .recruit-envelope-card.opened .resume-envelope-paper {
        transform: translateY(-58px) !important;
      }

      .recruit-envelope-card.envelope-white .resume-envelope-visual {
        filter: drop-shadow(0 18px 18px rgba(0,0,0,0.35)) drop-shadow(0 0 16px rgba(255, 228, 138, 0.56));
      }

      .recruit-envelope-card.envelope-brown .resume-envelope-visual {
        filter: drop-shadow(0 18px 18px rgba(0,0,0,0.38)) drop-shadow(0 0 22px rgba(255, 166, 45, 0.82));
      }

      .recruit-envelope-card.envelope-black .resume-envelope-visual {
        filter: drop-shadow(0 18px 18px rgba(0,0,0,0.42)) drop-shadow(0 0 25px rgba(187, 126, 255, 0.82));
      }

      .recruit-envelope-card.envelope-black .resume-envelope-back,
      .recruit-envelope-card.envelope-black .resume-envelope-body,
      .recruit-envelope-card.envelope-black .resume-envelope-flap {
        border-color: rgba(190, 145, 255, 0.56) !important;
      }

      .recruit-envelope-card.envelope-brown .resume-envelope-back,
      .recruit-envelope-card.envelope-brown .resume-envelope-body,
      .recruit-envelope-card.envelope-brown .resume-envelope-flap {
        border-color: rgba(255, 197, 92, 0.58) !important;
      }
    `}</style>

    {showTitleScreen && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "linear-gradient(135deg, #123524 0%, #1d5c3a 45%, #f3e2b8 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              "linear-gradient(90deg, rgba(255,255,255,0.24) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.24) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "min(420px, 94vw)",
            borderRadius: 24,
            padding: 24,
            background: "rgba(15, 38, 30, 0.88)",
            boxShadow: "0 24px 70px rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255,255,255,0.22)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 10 }}>🏘️</div>
          <p style={{ margin: "0 0 6px", letterSpacing: 2, fontSize: 12, opacity: 0.82 }}>NOGUCHI CORPORATION PRESENTS</p>
          <h1 style={{ margin: "0 0 8px", fontSize: 28, lineHeight: 1.25 }}>箱庭不動産経営<br />シミュレーション</h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.86 }}>Version 116</p>

          <div
            style={{
              margin: "0 auto 14px",
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.1)",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>会社名</label>
            <input
              type="text"
              value={newCompanyNameInput}
              onChange={(event) => setNewCompanyNameInput(event.target.value)}
              placeholder="会社名を入力"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.92)",
                color: "#123524",
                fontWeight: 700,
              }}
            />
          </div>

          <div
            style={{
              margin: "0 auto 18px",
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.1)",
              textAlign: "left",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <strong>セーブスロット</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {saveSlotSummaries.map((slotInfo) => (
                <div key={slotInfo.slot} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
                  <div>
                    <strong>Slot {slotInfo.slot}</strong>：{slotInfo.hasData ? `${slotInfo.companyName} / ${getGameDate(slotInfo.month).label} / ${Number(slotInfo.money ?? 0).toLocaleString()}万円` : "空き"}
                    {slotInfo.hasData && <div style={{ opacity: 0.72 }}>保存：{slotInfo.savedAtText}</div>}
                  </div>
                  <button type="button" onClick={() => startNewGameFromTitle(slotInfo.slot)} style={{ padding: "7px 9px", borderRadius: 999, border: "none", fontWeight: 700, cursor: "pointer" }}>
                    最初から
                  </button>
                  <button type="button" onClick={() => loadSaveSlotFromTitle(slotInfo.slot)} disabled={!slotInfo.hasData} style={{ padding: "7px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", background: slotInfo.hasData ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)", color: "#ffffff", fontWeight: 700, cursor: slotInfo.hasData ? "pointer" : "not-allowed", opacity: slotInfo.hasData ? 1 : 0.55 }}>
                    ロード
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" onClick={() => setTitleModal("settings")} style={{ padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>
              ▶ 設定
            </button>
            <button type="button" onClick={() => setTitleModal("credit")} style={{ padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.12)", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>
              ▶ クレジット
            </button>
          </div>

          <p style={{ margin: "18px 0 0", fontSize: 12, opacity: 0.72 }}>地方都市で土地を買い、建て、貸し、会社を育てる。</p>
        </div>

        {titleModal && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              background: "rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                width: "min(360px, 92vw)",
                borderRadius: 20,
                padding: 22,
                background: "#ffffff",
                color: "#1d2b22",
                boxShadow: "0 18px 60px rgba(0,0,0,0.34)",
                textAlign: "left",
              }}
            >
              {titleModal === "settings" ? (
                <>
                  <h2 style={{ marginTop: 0 }}>設定</h2>
                  <p>BGMはタイトル画面とゲーム内オプションで共通管理します。</p>
                  <div style={{ padding: 12, borderRadius: 12, background: "#f3f6f1", lineHeight: 1.7 }}>
                    <div>難易度：標準</div>
                    <div>BGM：{isBgmOn ? "ON" : "OFF"}</div>
                    <div>SE：準備中</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <button type="button" onClick={turnBgmOn} style={{ padding: "10px 12px", borderRadius: 999, border: "none", background: "#1d5c3a", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>
                      BGM ON
                    </button>
                    <button type="button" onClick={turnBgmOff} style={{ padding: "10px 12px", borderRadius: 999, border: "1px solid #b8c7b9", background: "#ffffff", color: "#1d2b22", fontWeight: 700, cursor: "pointer" }}>
                      BGM OFF
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ marginTop: 0 }}>クレジット</h2>
                  <div style={{ lineHeight: 1.9 }}>
                    <div><strong>企画・開発</strong></div>
                    <div>のぐちコーポレーション</div>
                    <div style={{ marginTop: 10 }}><strong>開発協力</strong></div>
                    <div>アイちゃん</div>
                    <div style={{ marginTop: 10 }}><strong>Powered by</strong></div>
                    <div>React + Vite</div>
                  </div>
                </>
              )}
              <button type="button" onClick={() => setTitleModal(null)} style={{ marginTop: 18, width: "100%", padding: "11px 14px", borderRadius: 999, border: "none", background: "#1d5c3a", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}>
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    )}

    <div className="app">
      {popupLog && (
  <div className="popup-log">
    <div className="popup-log-card">
      <h3>月末報告</h3>
<div>
  {popupLog.split("\n").map((line, index) => {
    const isRivalLine = Object.keys(RIVAL_COMPANIES).some((companyId) => {
      return tiles.some((tile) => {
        return tile.owner === OWNER.RIVAL &&
          tile.rivalCompanyId === companyId &&
          tile.feature === FEATURE.HQ;
      }) && line.startsWith(getRivalCompanyNameFromTiles(tiles, companyId));
    }) || line.startsWith("【経済ニュース】");

    const isPositive =
      !isRivalLine &&
      (line.includes("入居") ||
        line.includes("完成") ||
        line.includes("購入しました") ||
        line.includes("修繕") ||
        line.includes("外装工事") ||
        line.includes("大規模修繕"));

    const isNegative =
      !isRivalLine &&
      (line.includes("退去") ||
        line.includes("費用") ||
        line.includes("固定資産税") ||
        line.includes("取り壊し") ||
        line.includes("資金不足"));

    return (
      <p
        key={index}
        className={
          isPositive
            ? "log-positive"
            : isNegative
            ? "log-negative"
            : "log-normal"
        }
      >
        {line}
      </p>
    );
  })}
</div>

<button onClick={() => setPopupLog(null)}>OK</button>
    </div>
  </div>
)}


      {annualReport && (
        <div className="popup-log">
          <div className="popup-log-card annual-report-card">
            <h2>{annualReport.yearLabel} 決算報告</h2>
            <table className="employee-detail-table">
              <tbody>
                <tr><th>年間家賃収入</th><td>{annualReport.income.toLocaleString()}万円</td></tr>
                <tr><th>年間維持費</th><td>{annualReport.maintenance.toLocaleString()}万円</td></tr>
                <tr><th>年間固定資産税</th><td>{annualReport.tax.toLocaleString()}万円</td></tr>
                <tr><th>土地購入支払</th><td>{annualReport.purchase.toLocaleString()}万円</td></tr>
                <tr><th>税引前年間差引</th><td>{annualReport.net.toLocaleString()}万円</td></tr>
                <tr><th>法人税等</th><td>{(annualReport.corporateTax ?? 0).toLocaleString()}万円</td></tr>
                <tr><th>税引後年間差引</th><td>{(annualReport.netAfterTax ?? annualReport.net).toLocaleString()}万円</td></tr>
                <tr><th>期末現金</th><td>{annualReport.money.toLocaleString()}万円</td></tr>
                <tr><th>総資産</th><td>{annualReport.assetValue.toLocaleString()}万円</td></tr>
                <tr><th>プレイヤーランク</th><td>{annualReport.playerRank}</td></tr>
                <tr><th>プレイヤーEXP</th><td>{annualReport.playerExp} / {annualReport.nextPlayerExp}</td></tr>
              </tbody>
            </table>
            <button onClick={() => setAnnualReport(null)}>OK</button>
          </div>
        </div>
      )}
{employeeGachaResult && (
  <div className="popup-log">
    <div className={`popup-log-card employee-gacha-card rarity-${String(employeeGachaResult.rarity || "N").toLowerCase()}`}>
      <div className="gacha-ticket-animation">
        <span className="gacha-ticket-icon">{employeeGachaResult.awakened ? "🌟" : "🎫"}</span>
        <span className="gacha-ticket-flash">✨</span>
      </div>
      <h2>{employeeGachaResult.awakened ? "社員覚醒！" : employeeGachaResult.ticketType === "premium" ? "プレミアム社員採用！" : "社員採用！"}</h2>
      <p className="employee-gacha-rarity">{getRarityLabel(employeeGachaResult.rarity)}</p>
      <h3>{employeeGachaResult.name}</h3>
      {employeeGachaResult.awakened && (
        <p className="employee-awakening-result">覚醒 +{employeeGachaResult.beforeAwakening} → +{employeeGachaResult.afterAwakening}</p>
      )}
      <p>
        統率 {employeeGachaResult.leadership ?? 0} / 営業 {employeeGachaResult.sales ?? 0} / 建築 {employeeGachaResult.construction ?? 0} / 管理 {employeeGachaResult.management ?? 0}
      </p>
      {employeeGachaResult.awakeningMessages && (
        <p>{employeeGachaResult.awakeningMessages.join(" / ")}</p>
      )}
      <p>月給 {renderEmployeeSalaryValue(employeeGachaResult)}</p>
      <p>特殊能力 {getEmployeeSpecialText(employeeGachaResult)}</p>
      <button onClick={() => setEmployeeGachaResult(null)}>OK</button>
    </div>
  </div>
)}

{employeeRecruitmentOffer && (
  <div className="popup-log recruit-popup-stage">
    <div className="popup-log-card employee-recruitment-card recruit-desk-card">
      <div className="recruit-desk-decoration recruit-ink-bottle"></div>
      <div className="recruit-desk-decoration recruit-pen"></div>
      <div className="recruit-sparkle sparkle-a">✦</div>
      <div className="recruit-sparkle sparkle-b">✦</div>
      <div className="recruit-sparkle sparkle-c">✦</div>
      <div className="recruit-sparkle sparkle-d">✦</div>

      <div className="recruit-title-area">
        <div className="recruit-ornament">◇</div>
        <h2>{employeeRecruitmentOffer.ticketType === "premium" ? "プレミアム社員募集" : "社員募集"}</h2>
        <div className="recruit-ornament">◇</div>
        <p>履歴書が5通届きました</p>
      </div>

      <div className="recruit-envelope-grid recruit-envelope-desk-row">
        {employeeRecruitmentOffer.applicants.map((applicant, index) => {
          const isNewApplicant = !findOwnedEmployeeById(applicant.id);
          return (
            <button
              key={applicant.envelopeId}
              type="button"
              className={`recruit-envelope-card envelope-${applicant.envelopeType} ${applicant.opened ? "opened" : "closed"} ${employeeRecruitmentOffer.selectedEnvelopeId === applicant.envelopeId ? "selected" : ""}`}
              onClick={() => openRecruitEnvelope(applicant.envelopeId)}
              aria-label={`履歴書${index + 1}を開封する`}
            >
              {isNewApplicant && <span className="recruit-new-stamp envelope-new-stamp">NEW!</span>}
              <span className="resume-envelope-visual" aria-hidden="true">
                <span className="resume-envelope-back"></span>
                <span className="resume-envelope-paper">
                  <span className="resume-paper-title">履歴書</span>
                  <span className="resume-paper-line"></span>
                  <span className="resume-paper-line short"></span>
                </span>
                <span className="resume-envelope-flap"></span>
                <span className="resume-envelope-body"></span>
                <span className="resume-envelope-logo">NOGUCHI<br />CORP.</span>
                <span className="resume-envelope-seal"><span className="resume-seal-emblem" aria-hidden="true"></span></span>
                <span className="resume-envelope-shine"></span>
              </span>
              <span className="recruit-applicant-summary">
                {applicant.opened ? "開封済み" : "タップして確認"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="recruit-tap-guide">封筒をタップして履歴書を確認してください</div>

      {(() => {
        const selectedApplicant = employeeRecruitmentOffer.applicants.find((applicant) => applicant.envelopeId === employeeRecruitmentOffer.selectedEnvelopeId);
        if (!selectedApplicant || !selectedApplicant.opened) {
          return (
            <div className="recruit-profile-panel recruit-profile-empty">
              <div className="recruit-profile-empty-title">まだ履歴書が選択されていません</div>
              <p>封筒を開くと、ここに応募者のプロフィールと能力が表示されます。</p>
            </div>
          );
        }

        const isNewApplicant = !findOwnedEmployeeById(selectedApplicant.id);
        const awakeningText = isNewApplicant ? "新規採用" : "所持済み：採用すると覚醒";

        return (
          <div className="recruit-profile-wrap">
            <div className="recruit-profile-panel">
              <div className="recruit-profile-photo">
                {isNewApplicant && <span className="recruit-new-stamp profile-new-stamp">NEW!</span>}
                {selectedApplicant.graphicCode ? (
  <img
    className="recruit-character-image"
    src={`/characters/${selectedApplicant.graphicCode}.png`}
    alt={selectedApplicant.name}
  />
) : (
  <div className={`recruit-avatar recruit-avatar-${selectedApplicant.gender === "female" ? "female" : "male"}`}>
    <span>{selectedApplicant.name.slice(0, 1)}</span>
  </div>
)}
              </div>

              <div className="recruit-profile-main">
                <div className="recruit-profile-header">
                  <h3>{selectedApplicant.name}</h3>
                  <div className="recruit-job-and-stars">
                    <span className="recruit-job-badge">レア度</span>
                    <span className={`employee-rarity-label rarity-label-${String(selectedApplicant.rarity || "N").toLowerCase()}`}>{getRarityLabel(selectedApplicant.rarity)}</span>
                  </div>
                </div>

                <div className="recruit-profile-subrow">
                  <span>Lv.{selectedApplicant.level ?? 1}</span>
                  <span>{awakeningText}</span>
                </div>

                <div className="recruit-stat-grid">
                  <div><span>統率</span><strong>{selectedApplicant.leadership ?? 0}</strong></div>
                  <div><span>営業</span><strong>{selectedApplicant.sales ?? 0}</strong></div>
                  <div><span>建築</span><strong>{selectedApplicant.construction ?? 0}</strong></div>
                  <div><span>管理</span><strong>{selectedApplicant.management ?? 0}</strong></div>
                  <div><span>月給</span><strong>{renderEmployeeSalaryValue(selectedApplicant)}</strong></div>
                </div>

                <div className="recruit-special-box">
                  <span>特性</span>
                  <strong>{getEmployeeSpecialText(selectedApplicant)}</strong>
                </div>
              </div>
            </div>

            <div className="recruit-hire-side">
              <button className="recruit-hire-button" onClick={() => confirmRecruitApplicant(selectedApplicant)}>
                この社員を採用する
              </button>
              <p>※採用できるのは1名のみです</p>
            </div>
          </div>
        );
      })()}

      <div className="recruit-required-note recruit-required-note-fantasy">
        採用すると残り4通の履歴書とは縁がなかったことになります。
      </div>
    </div>
  </div>
)}
{employeeLevelUpResult && (
  <div className="popup-log">
    <div className="popup-log-card employee-levelup-card">
      <h2>レベルアップ！</h2>
      <p className="employee-gacha-rarity">Lv{employeeLevelUpResult.beforeLevel} → Lv{employeeLevelUpResult.level}</p>
      <h3>{employeeLevelUpResult.name}</h3>
      <p>{employeeLevelUpResult.statMessages?.join(" / ") || "能力上昇なし"}</p>
      <div className="employee-levelup-status-table-wrap">
        <table className="employee-detail-table employee-levelup-status-table">
          <thead>
            <tr>
              <th>項目</th>
              <th>上昇前</th>
              <th>現在</th>
              <th>上昇</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["統率", "leadership"],
              ["営業", "sales"],
              ["建築", "construction"],
              ["管理", "management"],
            ].map(([label, key]) => {
              const beforeValue = employeeLevelUpResult.beforeStats?.[key] ?? employeeLevelUpResult[`base${key.charAt(0).toUpperCase()}${key.slice(1)}`] ?? 0;
              const currentValue = employeeLevelUpResult[key] ?? beforeValue;
              const diff = currentValue - beforeValue;
              return (
                <tr key={key} className={diff > 0 ? "levelup-increased-row" : ""}>
                  <td>{label}</td>
                  <td>{beforeValue}</td>
                  <td>{currentValue}</td>
                  <td>{diff > 0 ? `+${diff}` : "-"}</td>
                </tr>
              );
            })}
            <tr className={employeeLevelUpResult.salaryDiff > 0 ? "levelup-increased-row" : ""}>
              <td>月給</td>
              <td>{employeeLevelUpResult.beforeSalary}万円</td>
              <td>{employeeLevelUpResult.salary}万円</td>
              <td>{employeeLevelUpResult.salaryDiff > 0 ? `+${employeeLevelUpResult.salaryDiff}万円` : "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>現在EXP {employeeLevelUpResult.exp ?? 0} / 次Lv {getEmployeeRequiredExp(employeeLevelUpResult.level ?? 1)}</p>
      <button onClick={() => setEmployeeLevelUpResult(null)}>OK</button>
    </div>
  </div>
)}
{playerRankUpResult && (
  <div className="popup-log">
    <div className="popup-log-card player-rankup-card">
      <h2>ランクアップ！</h2>
      <p className="employee-gacha-rarity">Rank{playerRankUpResult.beforeRank} → Rank{playerRankUpResult.rank}</p>
      <p>社員チケット +{playerRankUpResult.ticketCount}枚</p>
      {(playerRankUpResult.unlockMessages ?? []).length > 0 ? (
        <div>
          <h3>解放内容</h3>
          {(playerRankUpResult.unlockMessages ?? []).map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : (
        <p>新しいランク特典はありません。</p>
      )}
      <button onClick={() => setPlayerRankUpResult(null)}>OK</button>
    </div>
  </div>
)}

{ticketRewardResult && (
  <div className="popup-log">
    <div className={`popup-log-card ticket-reward-card ${ticketRewardResult.ticketType === "premium" ? "premium" : "normal"}`}>
      <h2>{ticketRewardResult.ticketType === "premium" ? "社員プレミアムチケット獲得！" : "社員チケット獲得！"}</h2>
      <p className="employee-gacha-rarity">+{ticketRewardResult.count}枚</p>
      <p>{ticketRewardResult.reason}</p>
      <button onClick={() => setTicketRewardResult(null)}>OK</button>
    </div>
  </div>
)}

{companyEmployeeListModal && (
  <div className="popup-log">
    <div className="popup-log-card company-employee-list-card">
      <h2>在籍社員一覧</h2>
      <h3>{companyEmployeeListModal.companyName}</h3>
      {(companyEmployeeListModal.employees ?? []).length === 0 ? (
        <p>在籍社員はいません。</p>
      ) : (
        <div className="employee-table-scroll">
          <table className="employee-detail-table company-employee-list-table">
            <thead>
              <tr>
                <th>{renderEmployeeSortHeader("名前", "name")}</th>
                <th>{renderEmployeeSortHeader("所属", "office")}</th>
                <th>{renderEmployeeSortHeader("レア", "rarity")}</th>
                <th>{renderEmployeeSortHeader("Lv", "level")}</th>
                <th>{renderEmployeeSortHeader("統率", "leadership")}</th>
                <th>{renderEmployeeSortHeader("営業", "sales")}</th>
                <th>{renderEmployeeSortHeader("建築", "construction")}</th>
                <th>{renderEmployeeSortHeader("管理", "management")}</th>
                <th>{renderEmployeeSortHeader("月給", "salary")}</th>
                <th>{renderEmployeeSortHeader("特殊能力", "special")}</th>
              </tr>
            </thead>
            <tbody>
              {sortEmployeesForDisplay(companyEmployeeListModal.employees ?? []).map((employee) => {
                const isStored = employee.isStoredEmployee === true || (companyEmployeeListModal.storageEmployeeIds ?? []).includes(employee.id);
                return (
                  <tr key={employee.id}>
                    <td>
                      <button className="employee-name-button" onClick={() => setSelectedEmployeeDetail(employee)}>
                        {employee.name}
                      </button>
                    </td>
                    <td>{getCompanyEmployeeOfficeName(employee, isStored)}</td>
                    <td>{getRarityLabel(employee.rarity)}</td>
                    <td>{employee.level ?? 1}</td>
                    <td>{employee.leadership ?? 0}</td>
                    <td>{employee.sales ?? 0}</td>
                    <td>{employee.construction ?? 0}</td>
                    <td>{employee.management ?? 0}</td>
                    <td>{isStored ? "給与なし" : renderEmployeeSalaryValue(employee)}</td>
                    <td>{getEmployeeSpecialText(employee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={() => setCompanyEmployeeListModal(null)}>閉じる</button>
    </div>
  </div>
)}

{companyBuildingListModal && (
  <div className="popup-log">
    <div className="popup-log-card company-building-list-card">
      <h2>所有建物一覧</h2>
      <h3>{companyBuildingListModal.companyName}</h3>
      {(companyBuildingListModal.buildings ?? []).length === 0 ? (
        <p>所有建物はありません。</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>座標</th>
                <th>建物</th>
                <th>部屋数</th>
                <th>入居数</th>
                <th>入居人数</th>
                <th>稼働率</th>
                <th>月家賃</th>
                <th>月維持費</th>
                <th>固定資産税/月割</th>
                <th>月利益</th>
              </tr>
            </thead>
            <tbody>
              {(companyBuildingListModal.buildings ?? []).map((tile) => {
                const building = tile.building
                  ? BUILDINGS[tile.building]
                  : { name: tile.hqName || tile.rivalOfficeName || "本社", rooms: 0, cost: tile.hqCost || 0 };
                const occupiedRooms = (tile.rooms ?? []).filter((room) => room.occupied);
                const people = occupiedRooms.reduce((sum, room) => sum + (room.people ?? 0), 0);
                const rent = occupiedRooms.reduce((sum, room) => sum + (room.rent ?? 0), 0);
                const monthlyExpense = tile.building ? calculateMonthlyExpenses(tile) : 0;
                const yearlyPropertyTax = tile.owner === OWNER.PLAYER
                  ? calculateYearlyPropertyTax(tile)
                  : calculateCompanyYearlyPropertyTax(tile);
                const monthlyTax = Math.round(yearlyPropertyTax / 12);
                const profit = rent - monthlyExpense - monthlyTax;
                const rate = (tile.rooms ?? []).length
                  ? Math.round((occupiedRooms.length / (tile.rooms ?? []).length) * 100)
                  : 0;

                return (
                  <tr
                    key={tile.id}
                    className="clickable-row"
                    onClick={() => {
                      selectBuildingFromList(tile.id);
                      setCompanyBuildingListModal(null);
                      setActivePanel("land");
                    }}
                  >
                    <td>{tile.x},{tile.y}</td>
                    <td>{building?.name ?? "建物"}</td>
                    <td>{(tile.rooms ?? []).length}</td>
                    <td>{occupiedRooms.length}</td>
                    <td>{people}</td>
                    <td>{rate}%</td>
                    <td>{rent}万円</td>
                    <td>{monthlyExpense}万円</td>
                    <td>{monthlyTax}万円</td>
                    <td>{profit}万円</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={() => setCompanyBuildingListModal(null)}>閉じる</button>
    </div>
  </div>
)}

{selectedEmployeeDetail && (
  <div className="popup-log">
    <div className={`popup-log-card employee-detail-card employee-detail-card-modern rarity-detail-${String(selectedEmployeeDetail.rarity || "N").toLowerCase()}`}>
      <div className="employee-detail-hero">
        <div className="employee-detail-portrait-wrap">
          {selectedEmployeeDetail.graphicCode ? (
            <img
              className="employee-detail-portrait-image"
              src={`/characters/${selectedEmployeeDetail.graphicCode}.png`}
              alt={selectedEmployeeDetail.name}
            />
          ) : (
            <div className={`employee-detail-portrait-avatar employee-detail-portrait-avatar-${selectedEmployeeDetail.gender === "female" ? "female" : "male"}`}>
              <span>{selectedEmployeeDetail.name.slice(0, 1)}</span>
            </div>
          )}
        </div>

        <div className="employee-detail-main-info">
          <span className={`employee-detail-rarity-badge rarity-label-${String(selectedEmployeeDetail.rarity || "N").toLowerCase()}`}>
            {getRarityLabel(selectedEmployeeDetail.rarity)}
          </span>
          <h3>{selectedEmployeeDetail.name}</h3>
          <p>覚醒 +{selectedEmployeeDetail.awakening ?? 0} / 所属：{getCompanyEmployeeOfficeName(selectedEmployeeDetail, selectedEmployeeDetail.isStoredEmployee === true)}</p>
          <p>
            Lv {selectedEmployeeDetail.level ?? 1} / EXP {selectedEmployeeDetail.exp ?? 0}
            / 次Lv必要 {getEmployeeRequiredExp(selectedEmployeeDetail.level ?? 1)}
            / 残り {Math.max(0, getEmployeeRequiredExp(selectedEmployeeDetail.level ?? 1) - (selectedEmployeeDetail.exp ?? 0))}
          </p>
        </div>
      </div>

      <div className="employee-detail-stat-card">
        <div><span>統率</span><strong>{renderEmployeeStatValue(selectedEmployeeDetail, "leadership", "baseLeadership")}</strong></div>
        <div><span>営業</span><strong>{renderEmployeeStatValue(selectedEmployeeDetail, "sales", "baseSales")}</strong></div>
        <div><span>建築</span><strong>{renderEmployeeStatValue(selectedEmployeeDetail, "construction", "baseConstruction")}</strong></div>
        <div><span>管理</span><strong>{renderEmployeeStatValue(selectedEmployeeDetail, "management", "baseManagement")}</strong></div>
        <div><span>月給</span><strong>{renderEmployeeSalaryValue(selectedEmployeeDetail)}</strong></div>
      </div>

      <h3 className="employee-detail-section-title">特殊能力</h3>
      {(Array.isArray(selectedEmployeeDetail.specialNames) && selectedEmployeeDetail.specialNames.length > 0) ? (
        <div className="employee-skill-list employee-skill-list-modern">
          {selectedEmployeeDetail.specialNames.map((skillName) => (
            <div key={skillName} className="employee-skill-item employee-skill-item-modern">
              <strong>{skillName}</strong>
              <p>{getSpecialSkillDescription(skillName)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>特殊能力なし</p>
      )}

      <button className="employee-detail-close-button" onClick={() => setSelectedEmployeeDetail(null)}>閉じる</button>
    </div>
  </div>
)}
{actionEmployeeRequest && (
  <div className="popup-log">
    <div className="popup-log-card employee-action-select-card">
      <h2>担当社員を選択</h2>
      <p>{actionEmployeeRequest.actionName}を担当する社員を選んでください。</p>
      <p>チェックを付けた社員がまとめて担当します。最大{actionEmployeeRequest.maxCount ?? 4}人まで選択できます。</p>
      {actionEmployeeRequest.baseMonths && actionEmployeeRequest.statKey && (
        <p className="employee-action-estimate">
          {formatActionEstimate(
            actionEmployeeRequest.baseMonths,
            estimateActionMonths(
              actionEmployeeRequest.baseMonths,
              actionEmployeeRequest.employees.filter((employee) => actionEmployeeSelectionIds.includes(employee.id)),
              actionEmployeeRequest.statKey
            )
          )}
        </p>
      )}
      <div className="employee-action-select-list">
        {actionEmployeeRequest.employees.map((employee) => {
          const checked = actionEmployeeSelectionIds.includes(employee.id);
          return (
            <label
              key={employee.id}
              className={`employee-action-select-button ${checked ? "selected" : ""}`}
            >
              <span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      if (actionEmployeeSelectionIds.length >= (actionEmployeeRequest.maxCount ?? 4)) {
                        alert(`最大${actionEmployeeRequest.maxCount ?? 4}人まで選択できます`);
                        return;
                      }
                      setActionEmployeeSelectionIds([...actionEmployeeSelectionIds, employee.id]);
                    } else {
                      setActionEmployeeSelectionIds(
                        actionEmployeeSelectionIds.filter((id) => id !== employee.id)
                      );
                    }
                  }}
                />
                <strong> {employee.name}</strong>
              </span>
              <span>{getRarityLabel(employee.rarity)} / Lv{employee.level ?? 1} / EXP {employee.exp ?? 0}</span>
              <span>統{renderEmployeeStatValue(employee, "leadership", "baseLeadership")} / 営{renderEmployeeStatValue(employee, "sales", "baseSales")} / 建{renderEmployeeStatValue(employee, "construction", "baseConstruction")} / 管{renderEmployeeStatValue(employee, "management", "baseManagement")}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          const selectedEmployees = actionEmployeeRequest.employees.filter((employee) => {
            return actionEmployeeSelectionIds.includes(employee.id);
          });
          if (selectedEmployees.length === 0) {
            alert("担当社員を1人以上選択してください");
            return;
          }
          actionEmployeeRequest.resolve(selectedEmployees);
          setActionEmployeeRequest(null);
          setActionEmployeeSelectionIds([]);
        }}
      >
        この社員で決定
      </button>
      <button
        type="button"
        onClick={() => {
          actionEmployeeRequest.resolve([]);
          setActionEmployeeRequest(null);
          setActionEmployeeSelectionIds([]);
        }}
      >
        キャンセル
      </button>
    </div>
  </div>
)}

      <header className="top-header compact-top-header">
        <div className="top-title-wrap">
          <h1 className="v73-title">箱庭不動産経営シミュレーター V108{isDemoMode ? "（デモ版）" : ""}</h1>
        </div>
      </header>

<nav className="bottom-menu compact-command-menu icon-command-menu v72-top-command-bar v73-top-command-bar" aria-label="メイン操作">
  <button
    type="button"
    title="ホーム"
    aria-label="ホーム"
    onClick={() => {
      setActivePanel(hqPlaced ? "home" : "hq");
      setMapViewMode("normal");
      setIsMainMenuOpen(false);
      setIsMoneyInfoOpen(false);
      setIsDateInfoOpen(false);
    }}
    className={`top-icon-button ${activePanel === "home" && mapViewMode === "normal" ? "active" : ""}`}
  >
    <span className="top-icon-symbol">🏠</span>
  </button>

  <button
    type="button"
    title="翌月へ"
    aria-label="翌月へ"
    disabled={!hqPlaced}
    onClick={() => {
      nextMonth();
      setIsMainMenuOpen(false);
      setIsMoneyInfoOpen(false);
      setIsDateInfoOpen(false);
    }}
    className="top-icon-button"
  >
    <span className="top-icon-symbol">⏭️</span>
  </button>

  <div className="top-status-inline v73-top-status-inline" aria-label="主要ステータス">
    {isDemoMode && (
      <button
        type="button"
        className="top-compact-stat top-compact-stat-button demo-money-add-button"
        title="デモ版：所持金を1億円追加"
        aria-label="デモ版：所持金を1億円追加"
        style={{
          width: 42,
          minWidth: 42,
          maxWidth: 42,
          height: 28,
          minHeight: 28,
          padding: 0,
          fontSize: 11,
          lineHeight: 1,
          flex: "0 0 42px",
        }}
        onClick={addDemoMoney100m}
      >
        ＋1億
      </button>
    )}

    <div className="top-status-chip-wrap">
      <button
        type="button"
        className={`top-compact-stat top-compact-stat-button ${isMoneyInfoOpen ? "active" : ""}`}
        title="資産情報"
        aria-label="資産情報"
        onClick={() => {
          setIsMoneyInfoOpen((current) => !current);
          setIsDateInfoOpen(false);
          setIsMainMenuOpen(false);
        }}
      >
        💰{money.toLocaleString()}万
      </button>
      {isMoneyInfoOpen && (
        <div className="top-info-popup top-info-popup-money">
          <h3>💰 資産</h3>
          <div className="top-info-popup-grid">
            <span>所持金</span>
            <strong>{money.toLocaleString()}万</strong>
            <span>総資産</span>
            <strong>{Math.round(money + assetValue).toLocaleString()}万</strong>
            <span>借入残高</span>
            <strong>{totalLoanRemaining.toLocaleString()}万</strong>
            <span>純資産</span>
            <strong>{netWorthAfterDebt.toLocaleString()}万</strong>
            <span>月家賃</span>
            <strong>{totalRent.toLocaleString()}万</strong>
            <span>維持費・給与</span>
            <strong>{totalMaintenance.toLocaleString()}万</strong>
            <span>月返済</span>
            <strong>{totalMonthlyLoanPayment.toLocaleString()}万</strong>
            <span>返済前月利益</span>
            <strong>{monthlyProfit.toLocaleString()}万</strong>
            <span>実質月利益</span>
            <strong>{monthlyProfitSign}{actualMonthlyProfit.toLocaleString()}万</strong>
            <span>空室率</span>
            <strong>{vacancyRate}%</strong>
          </div>
        </div>
      )}
    </div>

    <div className="top-status-chip-wrap">
      <button
        type="button"
        className="top-compact-stat"
        title={`実質月利益：${monthlyProfitSign}${actualMonthlyProfit.toLocaleString()}万`}
        aria-label={`実質月利益：${monthlyProfitSign}${actualMonthlyProfit.toLocaleString()}万`}
      >
        {monthlyProfitIcon}{monthlyProfitSign}{actualMonthlyProfit.toLocaleString()}万
      </button>
    </div>

    <div className="top-status-chip-wrap">
      <button
        type="button"
        className={`top-compact-stat top-compact-stat-button ${isDateInfoOpen ? "active" : ""}`}
        title="経過・プレイヤー情報"
        aria-label="経過・プレイヤー情報"
        onClick={() => {
          setIsDateInfoOpen((current) => !current);
          setIsMoneyInfoOpen(false);
          setIsMainMenuOpen(false);
        }}
      >
        📅{gameDate.label}
      </button>
      {isDateInfoOpen && (
        <div className="top-info-popup top-info-popup-date">
          <h3>📅 進行</h3>
          <div className="top-info-popup-grid">
            <span>現在</span>
            <strong>{gameDate.label}</strong>
            <span>経過</span>
            <strong>{month}ヶ月</strong>
            <span>ランク</span>
            <strong>{playerRank}</strong>
            <span>EXP</span>
            <strong>{playerExp} / {getPlayerRequiredExp(playerRank)}</strong>
            <span>人口</span>
            <strong>{totalPopulation.toLocaleString()}</strong>
            <span>社員</span>
            <strong>{employees.length}人 / 上限{employeeLimit}人</strong>
            <span>保管社員</span>
            <strong>{employeeStorage.length}人</strong>
            <span>支店</span>
            <strong>{branchCount}店</strong>
          </div>
        </div>
      )}
    </div>
  </div>

  <div className="main-menu-wrap v73-main-menu-wrap">
    <button
      type="button"
      title="メニュー"
      aria-label="メニュー"
      disabled={!hqPlaced}
      onClick={() => {
        setIsMainMenuOpen((current) => !current);
        setIsMoneyInfoOpen(false);
        setIsDateInfoOpen(false);
      }}
      className={`top-icon-button ${isMainMenuOpen ? "active" : ""}`}
    >
      <span className="top-icon-symbol">☰</span>
    </button>

    {isMainMenuOpen && (
      <div className="main-menu-popup icon-main-menu-popup">
        <button
          type="button"
          onClick={() => {
            setActivePanel("build");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "build" ? "active" : ""}
        >
          🏗 建設
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("employee");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "employee" ? "active" : ""}
        >
          👤 社員
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("property");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "property" ? "active" : ""}
        >
          🏠 物件
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("bank");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "bank" ? "active" : ""}
        >
          🏦 銀行
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("info");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "info" ? "active" : ""}
        >
          📊 情報
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("log");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "log" ? "active" : ""}
        >
          📜 ログ
        </button>
        <button
          type="button"
          onClick={() => {
            setActivePanel("option");
            setIsMainMenuOpen(false);
          }}
          className={activePanel === "option" ? "active" : ""}
        >
          ⚙️ オプション
        </button>
      </div>
    )}
  </div>
</nav>
<div className="game-layout"></div>

      <main className={`main-layout ${(activePanel === "home" || activePanel === "hq" || activePanel === "land" || activePanel === "build" || activePanel === "employee" || activePanel === "employeeLibrary" || activePanel === "property" || activePanel === "log" || activePanel === "option" || activePanel === "info" || activePanel === "bank") ? "full-panel" : ""}`}>
        {(activePanel === "home" || activePanel === "hq" || activePanel === "land" || activePanel === "build") && (
        <section className="map-section">
          <div className="panel-title-row map-title-row">
            <div className="map-title-status">
              <h2 className="v73-map-title">マップ</h2>
              <span className="map-compact-stat" title="人口">👥{totalPopulation.toLocaleString()}</span>
              <button
                type="button"
                title="地価表示"
                aria-label="地価表示"
                onClick={() => setMapViewMode("landPrice")}
                className={mapViewMode === "landPrice" ? "active" : ""}
              >
                💴
              </button>
              <button
                type="button"
                title="住宅需要マップ"
                aria-label="住宅需要マップ"
                onClick={() => setMapViewMode("housingDemand")}
                className={mapViewMode === "housingDemand" ? "active" : ""}
              >
                🏘
              </button>
              <button
                type="button"
                title="商業需要マップ"
                aria-label="商業需要マップ"
                onClick={() => setMapViewMode("commercialDemand")}
                className={mapViewMode === "commercialDemand" ? "active" : ""}
              >
                🏪
              </button>
              <button
                type="button"
                title="工業需要マップ"
                aria-label="工業需要マップ"
                onClick={() => setMapViewMode("industrialDemand")}
                className={mapViewMode === "industrialDemand" ? "active" : ""}
              >
                🏭
              </button>
            </div>
            <div className="zoom-controls">
              <button onClick={() => setTileSize(Math.max(18, tileSize - 2))}>－</button>
              <span>{tileSize}px</span>
              <button onClick={() => setTileSize(Math.min(40, tileSize + 2))}>＋</button>
            </div>
          </div>

          <div className="legend">
            <span>売=売り物件</span>
            <span>自=自分の空地</span>
            <span>□=大型建物</span>
            <span>道/駅/学/工=建築不可</span>
            <span>山/川/海=建築不可</span>
          </div>

          <div
            ref={mapScrollRef}
            className="map-scroll drag-scroll"
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerUp}
            onPointerCancel={handleMapPointerUp}
          >
            <div
  className="map-grid"
  style={{
    gridTemplateColumns: `28px repeat(${MAP_SIZE}, ${tileSize}px)`,
  }}
>
  <div className="coord-top-left"></div>

  {Array.from({ length: MAP_SIZE }).map((_, x) => (
    <div key={`x-${x}`} className="coord-header">
      {x}
    </div>
  ))}

  {Array.from({ length: MAP_SIZE }).map((_, y) => (
    <React.Fragment key={`row-${y}`}>
      <div className="coord-side">
        {y}
      </div>

      {tiles
        .filter((tile) => tile.y === y)
        .map((tile) => (
          <button
            key={tile.id}
            onClick={() => {
              if (shouldIgnoreTileClickAfterDrag()) return;

              setSelectedId(tile.id);

              if (!hqPlaced) {
                setActivePanel("hq");
                return;
              }

              if (pendingBuildKey) {
                build(pendingBuildKey, tile);
                return;
              }

              if (pendingBranchPlacement) {
                if (canUseAsBranchTarget(tile)) {
                  placeBranch(tile);
                  return;
                }

                setActivePanel("land");
                setLog("ここは支店候補地ではありません。緑枠の自分の空き土地を選択してください。支店建設をやめる場合は建設メニューで選択解除してください。");
                return;
              }

              setActivePanel("land");
            }}
            onDoubleClick={() => {
              setSelectedId(tile.id);

              if (!hqPlaced) {
                setActivePanel("hq");
                return;
              }

              if (tile.owner === OWNER.PLAYER) {
                setActivePanel("build");
                return;
              }

              setActivePanel("land");
            }}
            className={`map-tile ${
              selectedId === tile.id ? "selected" : ""
            } ${
              selectedOfficeTile &&
              isTileInSelectedOfficeRange(tile) &&
              selectedId !== tile.id
                ? "player-office-range-tile"
                : ""
            } ${
              false
                ? ""
                : ""
            } ${
              selectedRivalOfficeTile &&
              isTileInSelectedRivalOfficeRange(tile) &&
              selectedId !== tile.id
                ? getRivalCompany(selectedRivalOfficeTile.rivalCompanyId).rangeClass
                : ""
            } ${
              tile.owner === OWNER.PLAYER
                ? "player-owned-tile"
                : ""
            } ${
              pendingBuildKey && canUseAsBuildTarget(tile, pendingBuildKey)
                ? "pending-build-target"
                : ""
            } ${
              pendingBranchPlacement && canUseAsBranchTarget(tile)
                ? "pending-build-target"
                : ""
            } ${
              tile.owner === OWNER.RIVAL
                ? getRivalCompany(tile.rivalCompanyId).colorClass
                : ""
            }`}
            title={`座標:${tile.x},${tile.y} / ${getTerrainName(
              tile.terrain
            )} / ${getFeatureName(tile.feature)} / ${getTileOwnerName(tile)} / 地価:${tile.landPrice}万円${
              getNearestOfficeNameForTile(tile)
                ? ` / 行動範囲:${getNearestOfficeNameForTile(tile)}`
                : " / 行動範囲外"
            }`}
            style={{
              width: `${tileSize}px`,
              height: `${tileSize}px`,
              backgroundColor: getTileColor(tile),
            }}
          >
            {getTileLabel(tile)}
          </button>
        ))}
    </React.Fragment>
  ))}
</div>
          </div>
        </section>
        )}

        {(activePanel === "hq" || activePanel === "land" || activePanel === "build" || activePanel === "employee" || activePanel === "employeeLibrary") && (
  <section
    key={isFloatingPanelMode() ? `floating-panel-${floatingPanelResetKey}` : "normal-side-section"}
    className={isFloatingPanelMode() ? "side-section floating-panel" : "side-section"}
    ref={detailRef}
    style={isFloatingPanelMode() ? {
      "--floating-panel-left": `${floatingPanel.x}px`,
      "--floating-panel-top": `${floatingPanel.y}px`,
      "--floating-panel-width": `${floatingPanel.width}px`,
      "--floating-panel-height": `${floatingPanel.height}px`,
    } : undefined}
  >
    {isFloatingPanelMode() && (
      <div
        className="floating-panel-header"
        onPointerDown={handleFloatingPanelPointerDown}
        onPointerMove={handleFloatingPanelPointerMove}
        onPointerUp={handleFloatingPanelPointerUp}
        onPointerCancel={handleFloatingPanelPointerUp}
      >
        <strong>{getFloatingPanelTitle()}</strong>
        <div className="floating-panel-actions">
          <button type="button" onClick={(event) => { event.stopPropagation(); resetFloatingPanel(); }}>戻す</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); closeFloatingPanel(); }}>閉じる</button>
        </div>
      </div>
    )}
    {isFloatingPanelMode() && (
      <div
        className="floating-panel-resize-handle"
        title="ドラッグでサイズ変更"
        onPointerDown={handleFloatingPanelResizePointerDown}
        onPointerMove={handleFloatingPanelResizePointerMove}
        onPointerUp={handleFloatingPanelResizePointerUp}
        onPointerCancel={handleFloatingPanelResizePointerUp}
      />
    )}
{activePanel === "hq" && (
  <div className="detail-card">
    <p>最初に本社を設置してください。</p>

    {selectedTile ? (
      <div>
        <p>選択中土地 ({selectedTile.x}, {selectedTile.y})</p>
        <p>土地価格 {selectedTile.landPrice}万円</p>
        <p>所有 {getTileOwnerName(selectedTile)}</p>
        <p>
          建築 {isBuildableTile(selectedTile) ? "可能" : "不可"}
        </p>
      </div>
    ) : (
      <p>マップから売り土地を選択してください。</p>
    )}

<p>本社から5マス以内は</p>
<p>維持費50%OFF</p>
<p>入居率50%UP</p>

    <button onClick={() => placeHQ("normal")}>
      本社を設置
      {selectedTile
        ? `（合計 ${selectedTile.landPrice + 3000}万円）`
        : "（建設費3000万円）"}
    </button>

    <button onClick={() => placeHQ("apartment")}>
      アパート付き本社を設置
      {selectedTile
        ? `（合計 ${selectedTile.landPrice + 8000}万円）`
        : "（建設費8000万円・4戸付き）"}
    </button>
  </div>
)}
{activePanel === "land" && (
  <div className="detail-card">

    {!selectedTile && (
      <p>マップ上の土地を選択してください。</p>
    )}

    {selectedTile && (
      <>
        <p>座標 {selectedTile.x}, {selectedTile.y}</p>
        <p>地形 {getTerrainName(selectedTile.terrain)}</p>
        <p>施設 {getFeatureName(selectedTile.feature)}</p>
        <p>用途地域 {getZoneName(selectedTile.zone)}</p>
        <p>所有者 {getTileOwnerName(selectedTile)}</p>
        <p>地価 {selectedTile.landPrice}万円</p>
        <p>
          行動範囲 {isTileInOfficeRange(selectedTile) ? `範囲内（${getNearestOfficeNameForTile(selectedTile)}）` : "範囲外"}
        </p>
        <p>建築可否 {isBuildableTile(selectedTile) ? "建築可能" : "建築不可"}</p>

        {selectedTile.feature === FEATURE.HQ && (
          <p>本社 {selectedTile.hqName || "本社"}</p>
        )}

        {selectedTile.feature === FEATURE.BRANCH && (
          <p>支店 {getBranchDisplayName(selectedTile)}</p>
        )}
        {selectedTile.owner === OWNER.RIVAL && (
          <div className="rival-company-info">
            <h3>{getRivalCompanyNameFromTiles(tiles, selectedTile.rivalCompanyId)}</h3>
            <p>拠点: {selectedTile.rivalOfficeName || "ライバル拠点"}</p>
            <p>企業カラー: {getRivalCompany(selectedTile.rivalCompanyId).colorName}</p>
            <h4>所属社員</h4>
            {(selectedTile.rivalEmployees ?? []).length === 0 ? (
              <p>所属社員情報はありません。</p>
            ) : (
              <div className="rival-table-scroll employee-table-scroll">
                <table className="rival-employee-table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>レア</th>
                      <th>統率</th>
                      <th>営業</th>
                      <th>建築</th>
                      <th>管理</th>
                      <th>特殊能力</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTile.rivalEmployees ?? []).map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.name}</td>
                        <td>{getRarityLabel(employee.rarity)}</td>
                        <td>{employee.leadership}</td>
                        <td>{employee.sales}</td>
                        <td>{employee.construction}</td>
                        <td>{employee.management}</td>
                        <td>{getEmployeeSpecialText(employee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(selectedTile.feature === FEATURE.HQ || selectedTile.feature === FEATURE.BRANCH) && (
          <div className="office-range-info">
            <strong>この拠点の行動範囲: {getOfficeActionRange(selectedTile)}マス</strong>
            <br />
            マップ上の枠線が、この拠点から行動できる範囲です。
          </div>
        )}

   {selectedBuilding && (
  <div className="building-detail-box">
    <h3>建物情報</h3>

    <p>
      建物名 {selectedBuilding.name || "建物あり"}
    </p>

    <p>
      種別 {selectedBuilding.category || "不明"}
    </p>

    <p>
      構造 {selectedBuilding.structure || "不明"}
    </p>

    <p>
      築年数 {Math.floor(selectedMainTile.age ?? 0)}年
    </p>

    <p>
      建物状態 {Math.round(selectedMainTile.condition ?? 100)}%
    </p>

    <p>
      戸数 {selectedMainTile.rooms?.length ?? 0}戸
    </p>

    <p>
      入居中 {
        selectedMainTile.rooms?.filter((room) => room.occupied).length ?? 0
      }戸
    </p>

    <p>
      空室 {
        (selectedMainTile.rooms?.length ?? 0) -
        (selectedMainTile.rooms?.filter((room) => room.occupied).length ?? 0)
      }戸
    </p>

    <p>
      月家賃 {
        selectedMainTile.rooms?.reduce((sum, room) => {
          return sum + (room.occupied ? room.rent : 0);
        }, 0) ?? 0
      }万円
    </p>
    <p>
  需要 {getDemand(selectedMainTile, selectedMainTile.building)}%
</p>

<p>
  想定家賃倍率 {getRentMultiplier(selectedMainTile, selectedMainTile.building).toFixed(2)}倍
</p>

<p>
  月間維持費 {calculateMonthlyExpenses(selectedMainTile)}万円
</p>

<p>
  月間収支 {
    (selectedMainTile.rooms?.reduce((sum, room) => {
      return sum + (room.occupied ? room.rent : 0);
    }, 0) ?? 0) - calculateMonthlyExpenses(selectedMainTile)
  }万円
</p>

<p>
  建物価値 {calculateBuildingValue(selectedMainTile)}万円
</p>

<p>
  年間固定資産税 {selectedMainTile.owner === OWNER.PLAYER
    ? calculateYearlyPropertyTax(selectedMainTile)
    : calculateCompanyYearlyPropertyTax(selectedMainTile)}万円
</p>

<p>
  回収率 {
    selectedMainTile.building
      ? (
          ((selectedMainTile.rooms?.reduce((sum, room) => {
            return sum + (room.occupied ? room.rent : 0);
          }, 0) ?? 0) * 12 / Math.max(1, selectedBuilding.cost)) * 100
        ).toFixed(1)
      : "0.0"
  }%
</p>

  </div>
  )}
  {selectedBuilding && (
  <div className="building-detail-box">
    <h3>部屋別入居状況</h3>

            {(selectedMainTile.rooms ?? []).length === 0 ? (
      <p>部屋情報はまだありません。</p>
    ) : (
      <div className="table-scroll">
        <table className="property-table">
          <thead>
            <tr>
              <th>部屋</th>
              <th>状況</th>
              <th>入居者</th>
              <th>人数</th>
              <th>賃料</th>
            </tr>
          </thead>

          <tbody>
            {(selectedMainTile.rooms ?? []).map((room) => (
              <tr key={room.roomNo}>
                <td>{room.roomNo}号室</td>
                <td>{room.occupied ? "入居中" : "空室"}</td>
                <td>
                  {room.tenantType
                    ? TENANT_TYPES[room.tenantType]?.name
                    : "-"}
                </td>
                <td>{room.people ?? 0}人</td>
                <td>{room.rent ?? 0}万円</td>
              </tr>
                        ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

        <div className="button-row">
          {selectedMainTile?.owner === OWNER.SALE && (
            <button
              onClick={buyLand}
              disabled={!isTileInOfficeRange(selectedMainTile)}
              title={!isTileInOfficeRange(selectedMainTile) ? "本社・支店の行動範囲外です" : ""}
            >
              {isTileInOfficeRange(selectedMainTile) ? "購入する" : "範囲外のため購入不可"}
            </button>
          )}

          {selectedTile.owner === OWNER.PLAYER &&
            isBuildableTile(selectedTile) &&
            !selectedTile.building && (
              <button
                onClick={() => setActivePanel("build")}
                disabled={!isTileInOfficeRange(selectedTile)}
                title={!isTileInOfficeRange(selectedTile) ? "本社・支店の行動範囲外です" : ""}
              >
                {isTileInOfficeRange(selectedTile) ? "建設する" : "範囲外のため建設不可"}
              </button>
            )}

{selectedMainTile?.owner === OWNER.PLAYER &&
  selectedMainTile?.building && (
    <button
      onClick={() => {
        setSelectedBuildCategory("修繕");
        setActivePanel("build");
      }}
    >
      修繕する
    </button>
)}

{selectedMainTile?.owner === OWNER.PLAYER &&
  selectedMainTile?.feature !== FEATURE.HQ && (
    <button onClick={sellProperty}>
      売却する
    </button>
)}

{selectedMainTile?.owner === OWNER.PLAYER &&
  selectedMainTile?.building && (
    <button onClick={demolish}>
      取り壊す
    </button>
)}
        </div>
      </>
    )}
  </div>
)}
            {activePanel === "employee" && (
  <div className="detail-card">
    <h2>社員管理</h2>

    <div className="employee-subnav-row">
      <button
        type="button"
        className={activePanel === "employee" ? "active" : ""}
        onClick={() => setActivePanel("employee")}
      >
        社員管理
      </button>
      <button
        type="button"
        className={activePanel === "employeeLibrary" ? "active" : ""}
        onClick={() => setActivePanel("employeeLibrary")}
      >
        社員図鑑
      </button>
    </div>

    <p>
      配属社員: {employeeCountText}人 / 保有社員: {ownedEmployeeCount}人 / 待機社員: {employeeStorage.length}人 / 月給合計: {employeeSalaryTotal}万円 / 社員チケット: {employeeTickets}枚 / プレミアム: {premiumEmployeeTickets}枚
    </p>
    <p className="employee-salary-note">※月給が発生するのは本社・支店に配属中の社員だけです。社員保管庫の待機社員は給与なしです。</p>

    <div className="button-row ticket-button-row">
      <button
        className="employee-ticket-button normal-ticket-button"
        disabled={employeeTickets < 1}
        onClick={recruitEmployees}
      >
        {employeeTickets < 1
          ? "社員採用（チケット不足）"
          : "社員採用"}
      </button>

      {isDemoMode && (
        <button onClick={addEmployeeTicketForDemo}>
          採用券+1
        </button>
      )}

      <button
        className="employee-ticket-button premium-ticket-button"
        disabled={premiumEmployeeTickets < 1}
        onClick={recruitPremiumEmployees}
      >
        {premiumEmployeeTickets < 1
          ? "社員採用（プラチナ不足）"
          : "社員採用（プラチナ）"}
      </button>

      {isDemoMode && (
        <button onClick={addPremiumEmployeeTicketForDemo}>
          プラチナ採用券+1
        </button>
      )}
    </div>

    <div className="ticket-odds-box">
      {employeeTickets > 0 && (
        <p><strong>社員チケット排出率:</strong> {getTicketOddsText("normal")}</p>
      )}
      {premiumEmployeeTickets > 0 && (
        <p><strong>社員プレミアムチケット排出率:</strong> {getTicketOddsText("premium")}</p>
      )}
    </div>

    <div className="employee-sort-row">
      <span>表の見出しを押すと並び替えできます。もう一度押すと昇順・降順が切り替わります。</span>
    </div>

    <h3>配属中社員</h3>

    {employees.length === 0 && (
      <p>現在、配属中の社員はいません。社員保管庫から本社・支店へ配属してください。</p>
    )}

    {employees.length > 0 && (
      <div className="employee-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{renderEmployeeSortHeader("名前", "name")}</th>
              <th>{renderEmployeeSortHeader("レア", "rarity")}</th>
              <th>{renderEmployeeSortHeader("Lv", "level")}</th>
              <th>{renderEmployeeSortHeader("EXP", "exp")}</th>
              <th>{renderEmployeeSortHeader("統率", "leadership")}</th>
              <th>{renderEmployeeSortHeader("営業", "sales")}</th>
              <th>{renderEmployeeSortHeader("建築", "construction")}</th>
              <th>{renderEmployeeSortHeader("管理", "management")}</th>
              <th>{renderEmployeeSortHeader("月給", "salary")}</th>
              <th>{renderEmployeeSortHeader("特殊能力", "special")}</th>
              <th>{renderEmployeeSortHeader("所属", "office")}</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {sortEmployeesForDisplay(employees.filter((employee) => employee.id !== 0)).map((employee) => (
              <tr key={employee.id}>
                <td>{renderEmployeeNameButton(employee)}</td>
                <td>{getRarityLabel(employee.rarity)}</td>
                <td>{employee.level ?? 1}</td>
                <td>{employee.exp ?? 0}</td>
                <td>{renderEmployeeStatValue(employee, "leadership", "baseLeadership")}</td>
                <td>{renderEmployeeStatValue(employee, "sales", "baseSales")}</td>
                <td>{renderEmployeeStatValue(employee, "construction", "baseConstruction")}</td>
                <td>{renderEmployeeStatValue(employee, "management", "baseManagement")}</td>
                <td>{renderEmployeeSalaryValue(employee)}</td>
                <td>{getEmployeeSpecialText(employee)}</td>
                <td>
                  <select
                    value={employee.officeId ?? "hq"}
                    onChange={(event) => moveEmployee(employee.id, event.target.value)}
                  >
                    {officeTiles.map((officeTile) => (
                      <option
                        key={officeTile.officeId ?? "hq"}
                        value={officeTile.officeId ?? "hq"}
                      >
                        {officeTile.officeName ?? officeTile.hqName ?? "本社"}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <button onClick={() => unassignEmployee(employee)}>
                    待機へ戻す
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <h3>社員保管庫</h3>

    {employeeStorage.length === 0 && (
      <p>社員チケットを使うと、獲得した社員がここに保管されます。</p>
    )}

    {employeeStorage.length > 0 && (
      <div className="employee-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{renderEmployeeSortHeader("名前", "name")}</th>
              <th>{renderEmployeeSortHeader("レア", "rarity")}</th>
              <th>{renderEmployeeSortHeader("Lv", "level")}</th>
              <th>{renderEmployeeSortHeader("EXP", "exp")}</th>
              <th>{renderEmployeeSortHeader("統率", "leadership")}</th>
              <th>{renderEmployeeSortHeader("営業", "sales")}</th>
              <th>{renderEmployeeSortHeader("建築", "construction")}</th>
              <th>{renderEmployeeSortHeader("管理", "management")}</th>
              <th>{renderEmployeeSortHeader("月給", "salary")}</th>
              <th>{renderEmployeeSortHeader("特殊能力", "special")}</th>
              <th>{renderEmployeeSortHeader("配属", "office")}</th>
            </tr>
          </thead>

          <tbody>
            {sortEmployeesForDisplay(employeeStorage).map((employee) => (
              <tr key={employee.id}>
                <td>{renderEmployeeNameButton(employee)}</td>
                <td>{getRarityLabel(employee.rarity)}</td>
                <td>{employee.level ?? 1}</td>
                <td>{employee.exp ?? 0}</td>
                <td>{renderEmployeeStatValue(employee, "leadership", "baseLeadership")}</td>
                <td>{renderEmployeeStatValue(employee, "sales", "baseSales")}</td>
                <td>{renderEmployeeStatValue(employee, "construction", "baseConstruction")}</td>
                <td>{renderEmployeeStatValue(employee, "management", "baseManagement")}</td>
                <td>{renderEmployeeSalaryValue(employee)}</td>
                <td>{getEmployeeSpecialText(employee)}</td>
                <td>
                  <div className="button-row">
                    {officeTiles.map((officeTile) => {
                      const officeId = officeTile.officeId ?? "hq";
                      const officeName = officeTile.officeName ?? officeTile.hqName ?? "本社";
                      const officeCount = employees.filter((item) => {
                        return (item.officeId ?? "hq") === officeId;
                      }).length;
                      const isFull = officeCount >= MAX_EMPLOYEES_PER_OFFICE;

                      return (
                        <button
                          key={officeId}
                          disabled={isFull}
                          onClick={() => assignStoredEmployee(employee, officeId)}
                        >
                          {isFull ? `${officeName}満員` : `${officeName}へ`}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}


{activePanel === "employeeLibrary" && (
  <div className="detail-card employee-library-panel">
    <div className="employee-library-header">
      <div>
        <h2>社員図鑑</h2>
        <div className="employee-subnav-row employee-library-subnav-row">
          <button
            type="button"
            onClick={() => setActivePanel("employee")}
          >
            社員管理
          </button>
          <button
            type="button"
            className="active"
            onClick={() => setActivePanel("employeeLibrary")}
          >
            社員図鑑
          </button>
        </div>
        <p>
          採用済み {ownedEmployeeLibrary.length}人 / 全{EMPLOYEE_POOL.length}人
          （コンプリート率 {employeeLibraryCompletionRate}%）
        </p>
      </div>
      <div className="employee-library-summary">
        {employeeLibraryRarityOptions.filter((rarity) => rarity !== "ALL").map((rarity) => (
          <span key={rarity} className={`employee-library-summary-chip rarity-${String(rarity).toLowerCase()}`}>
            {rarity}: {employeeLibraryCounts[rarity] ?? 0}
          </span>
        ))}
      </div>
    </div>

    <div className="employee-library-filter-row">
      {employeeLibraryRarityOptions.map((rarity) => (
        <button
          key={rarity}
          type="button"
          onClick={() => setEmployeeLibraryFilter(rarity)}
          className={employeeLibraryFilter === rarity ? "active" : ""}
        >
          {rarity === "ALL" ? "全員" : rarity}
        </button>
      ))}
    </div>

    {filteredEmployeeLibrary.length === 0 ? (
      <p>この条件に一致する採用済み社員はいません。</p>
    ) : (
      <div className="employee-library-grid">
        {sortEmployeesForDisplay(filteredEmployeeLibrary).map((employee) => (
          <button
            key={employee.id}
            type="button"
            className={`employee-library-card rarity-card-${String(employee.rarity || "N").toLowerCase()}`}
            onClick={() => setSelectedEmployeeDetail(employee)}
          >
            <div className="employee-library-portrait">
              {employee.graphicCode ? (
                <img
                  src={`/characters/${employee.graphicCode}.png`}
                  alt={employee.name}
                />
              ) : (
                <span>{employee.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="employee-library-card-body">
              <strong>{employee.name}</strong>
              <span className={`employee-library-rarity rarity-label-${String(employee.rarity || "N").toLowerCase()}`}>
                {getRarityLabel(employee.rarity)}
              </span>
              <small className="employee-library-level-line">
                Lv.{employee.level ?? 1} / 覚醒+{employee.awakening ?? 0}
              </small>
              <div className="employee-library-mini-stats">
                <span>統率 {employee.leadership ?? 0}</span>
                <span>営業 {employee.sales ?? 0}</span>
                <span>建築 {employee.construction ?? 0}</span>
                <span>管理 {employee.management ?? 0}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
)}

{activePanel === "build" && (
  <div className="detail-card build-pop-card">

    {pendingBuildKey && (
      <div className="build-placement-guide">
        <p>{BUILDINGS[pendingBuildKey]?.name}を建てる土地を選択中です。行動範囲内の自分の空き土地をマップでクリックしてください。</p>
        <button
          type="button"
          onClick={() => {
            setPendingBuildKey(null);
            setLog("建設する土地の選択を解除しました。");
          }}
        >
          建設選択をやめる
        </button>
      </div>
    )}

    {pendingBranchPlacement && (
      <div className="build-placement-guide">
        <p>支店を建てる土地を選択中です。本社・支店の行動範囲内にある自分の空き土地をマップでクリックしてください。近すぎると営業範囲は広がりにくくなります。</p>
        <button
          type="button"
          onClick={() => {
            setPendingBranchPlacement(false);
            setSelectedBuildCategory(null);
            setLog("支店建設の土地選択を解除しました。");
          }}
        >
          支店建設をやめる
        </button>
      </div>
    )}

    <div className="build-icon-menu">
  <button
  className={`build-icon-button ${
    selectedBuildCategory === "住宅" ? "active" : ""
  }`}
  onClick={() => {
  setSelectedBuildCategory("住宅");
  setSelectedHousingType(null);
}}
>
  <span className="build-icon">🏠</span>
  <span>住宅</span>
</button>

      <button
        className={`build-icon-button ${
          selectedBuildCategory === "商業" ? "active" : ""
        }`}
        onClick={() => { setSelectedBuildCategory("商業"); setSelectedHousingType(null); }}
      >
        <span className="build-icon">🏪</span>
        <span>店舗</span>
      </button>
            <button
        className={`build-icon-button ${
          selectedBuildCategory === "工業" ? "active" : ""
        }`}
        onClick={() => { setSelectedBuildCategory("工業"); setSelectedHousingType(null); }}
      >
        <span className="build-icon">🏭</span>
        <span>工業</span>
      </button>

      <button
        className={`build-icon-button ${
          selectedBuildCategory === "支店" ? "active" : ""
        }`}
        onClick={() => { setSelectedBuildCategory("支店"); setSelectedHousingType(null); }}
      >
        <span className="build-icon">🏢</span>
        <span>支店</span>
      </button>

      <button
        className={`build-icon-button ${
          selectedBuildCategory === "修繕" ? "active" : ""
        }`}
        onClick={() => { setSelectedBuildCategory("修繕"); setSelectedHousingType(null); }}
      >
        <span className="build-icon">🔧</span>
        <span>修繕</span>
      </button>
    </div>

    {!selectedBuildCategory && (
      <p className="build-help-text">
        建てたい種類を選んでください。
      </p>
    )}

{selectedBuildCategory && (
  <div className="build-detail-popup">
    <div className="build-detail-header">
      <strong>{selectedHousingType ? selectedHousingType : selectedBuildCategory}を選択中</strong>

      <div className="button-row" style={{ gap: 6 }}>
        {selectedBuildCategory === "住宅" && selectedHousingType && (
          <button
            className="build-close-button"
            onClick={() => setSelectedHousingType(null)}
          >
            戻る
          </button>
        )}

        <button
          className="build-close-button"
          onClick={() => {
            setSelectedBuildCategory(null);
            setSelectedHousingType(null);
          }}
        >
          閉じる
        </button>
      </div>
    </div>

    <div className="build-detail-buttons">
    {selectedBuildCategory === "住宅" && !selectedHousingType && (
  <>
    <button
      className="build-detail-button"
      onClick={() => setSelectedHousingType("戸建")}
    >
      <strong>戸建</strong>
      <span>平屋・2、3階建て</span>
    </button>

    <button
      className="build-detail-button"
      onClick={() => setSelectedHousingType("アパート")}
    >
      <strong>アパート</strong>
      <span>2、3階建て</span>
    </button>

    <button
      className="build-detail-button"
      onClick={() => setSelectedHousingType("マンション")}
    >
      <strong>マンション</strong>
      <span>5、7階建て</span>
    </button>
  </>
)}
      {selectedBuildCategory === "支店" && (
        <>
          <button
            className="build-detail-button"
            onClick={startBranchPlacement}
          >
            <strong>支店</strong>
            <span>建築費: 1億円</span>
            <span>社員上限: +10人</span>
            <span>営業範囲: 10マス</span>
            <span>条件: 次の支店数 × 5人以上の社員が配属中</span>
            <span>条件: 本社・支店の行動範囲内の自分の空き土地</span>
            <span>工期: 6ヶ月</span>
          </button>
        </>
      )}

      {selectedBuildCategory !== "修繕" && selectedBuildCategory !== "支店" &&
        Object.entries(BUILDINGS)
          .filter(([, building]) => {
  if (selectedBuildCategory !== "住宅") {
    return building.category === selectedBuildCategory;
  }

  return (
    building.category === "住宅" &&
    building.subCategory === selectedHousingType
  );
})
          .map(([key, building]) => {
            const requiredRank = getRequiredRankForBuilding(key);
            const unlocked = isBuildingUnlockedForRank(key, playerRank);

            return (
              <button
                key={key}
                className={`build-detail-button ${unlocked ? "" : "locked-build-button"}`}
                onClick={() => {
                  if (!unlocked) {
                    alert(`${building.name}はプレイヤーランク${requiredRank}で解放されます。`);
                    return;
                  }
                  startBuildPlacement(key);
                }}
                title={`${building.rooms}室 / ${building.width}×${building.height}マス必要`}
              >
                <strong>{building.name}</strong>
                {!unlocked && <span className="locked-build-label">未開放：Rank{requiredRank}で解放</span>}
                {unlocked && <span className="unlocked-build-label">建築可能</span>}
                <span>建築費:{building.cost}万円</span>
                <span>戸数:{building.rooms}戸</span>
                <span>1戸賃料:{building.baseRent}万円</span>
                <span>満室想定:{building.baseRent * building.rooms}万円</span>
                <span>必要マス:{building.width}×{building.height}</span>
                <span>工期:{building.buildMonths}ヶ月</span>
              </button>
            );
          })}

      {selectedBuildCategory === "修繕" && (
        <>
          <button
            className="build-detail-button"
            onClick={() => repairBuilding("light")}
          >
            <strong>軽修繕</strong>
            <span>費用: 建築費の3%</span>
            <span>効果: 建物状態 +15%</span>
            <span>工期: 1ヶ月</span>
          </button>

          <button
            className="build-detail-button"
            onClick={() => repairBuilding("exterior")}
          >
            <strong>外装工事</strong>
            <span>費用: 建築費の5%</span>
            <span>効果: 建物状態 +30%</span>
            <span>工期: 2ヶ月</span>
          </button>

          <button
            className="build-detail-button"
            onClick={() => repairBuilding("major")}
          >
            <strong>大規模修繕</strong>
            <span>費用: 建築費の12%</span>
            <span>効果: 建物状態 +60%</span>
            <span>工期: 4ヶ月</span>
          </button>
        </>
      )}
    </div>
  </div>
)}
  </div>
)}
</section>
)}
            

{activePanel === "bank" && (
  <section className="property-section info-section bank-section">
    <h2>銀行・融資</h2>

    <div className="player-info-box v74-player-info-box">
      <h3>融資状況</h3>
      <div className="player-info-grid">
        <div>
          <span>所持金</span>
          <strong>{money.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>総資産</span>
          <strong>{Math.round(money + assetValue).toLocaleString()}万円</strong>
        </div>
        <div>
          <span>借入残高</span>
          <strong>{totalLoanRemaining.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>純資産</span>
          <strong>{netWorthAfterDebt.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>借入比率</span>
          <strong>{debtRatio}%</strong>
        </div>
        <div>
          <span>月返済</span>
          <strong>{totalMonthlyLoanPayment.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>審査中融資</span>
          <strong>{totalPendingLoanAmount.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>返済前月利益</span>
          <strong>{monthlyProfit.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>返済後月利益</span>
          <strong>{(monthlyProfit - totalMonthlyLoanPayment).toLocaleString()}万円</strong>
        </div>
      </div>
    </div>

    <div className="detail-card">
      <h3>融資相談</h3>
      <p>v96では、融資相談結果に6ヶ月の有効期限を設定し、相談結果から申請した場合は該当する相談結果を自動で整理します。</p>
      <div className="table-scroll">
        <table className="property-table">
          <thead>
            <tr>
              <th>金融機関</th>
              <th>標準金利</th>
              <th>返済期間</th>
              <th>現在の目安枠</th>
              <th>特徴</th>
              <th>相談</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(BANKS).map((bank) => {
              const capacity = loanCapacityByBank[bank.id];
              const alreadyPending = pendingLoanConsultations.some((consultation) => consultation.bankId === bank.id);

              return (
                <tr key={`consult-${bank.id}`}>
                  <td>{bank.name}</td>
                  <td>{(bank.rate * 100).toFixed(1)}%</td>
                  <td>{bank.maxYears}年</td>
                  <td>{(capacity?.remainingLimit ?? 0).toLocaleString()}万円</td>
                  <td>{bank.description}</td>
                  <td>
                    <button
                      disabled={alreadyPending}
                      onClick={() => startLoanConsultation(bank.id)}
                    >
                      {alreadyPending ? "相談中" : "相談する"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    <div className="detail-card">
      <h3>相談中の融資相談</h3>
      {pendingLoanConsultations.length === 0 ? (
        <p>現在、相談中の銀行はありません。</p>
      ) : (
        <div className="table-scroll">
          <table className="property-table">
            <thead>
              <tr>
                <th>金融機関</th>
                <th>依頼時期</th>
                <th>残り</th>
                <th>担当</th>
                <th>相談力</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoanConsultations.map((consultation) => (
                <tr key={consultation.id}>
                  <td>{consultation.bankName}</td>
                  <td>{consultation.requestedAt || "-"}</td>
                  <td>{consultation.monthsLeft}ヶ月</td>
                  <td>{consultation.employeeName || "-"}</td>
                  <td>{consultation.consultationPower}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <div className="detail-card">
      <h3>融資相談結果</h3>
      <p>相談結果の有効期限は6ヶ月です。相談結果から融資申請した場合、その相談結果は一覧から自動で消えます。</p>
      {loanConsultationReports.length === 0 ? (
        <p>まだ融資相談結果はありません。まずは金融機関へ相談してください。</p>
      ) : (
        <div className="table-scroll">
          <table className="property-table">
            <thead>
              <tr>
                <th>金融機関</th>
                <th>結果時期</th>
                <th>担当</th>
                <th>推定融資枠</th>
                <th>銀行員コメント</th>
                <th>申請</th>
              </tr>
            </thead>
            <tbody>
              {loanConsultationReports.map((report) => {
                const defaultReportAmount = Math.max(0, Math.round(report.recommendedAmount ?? 0));
                const reportAmountValue = consultationApplicationAmounts[report.id] ?? String(defaultReportAmount);
                const reportApplyAmount = Math.max(0, Math.round(Number(reportAmountValue) || 0));

                return (
                  <tr key={report.id}>
                    <td>{report.bankName}</td>
                    <td>{report.reportedAt || "-"}</td>
                    <td>{report.employeeName || "-"}</td>
                    <td>{report.estimatedMin.toLocaleString()}万〜{report.estimatedMax.toLocaleString()}万円</td>
                    <td>
                      <div>{report.comment}</div>
                      {(report.riskNotes ?? []).length > 0 && (
                        <small>注意: {(report.riskNotes ?? []).join("・")}</small>
                      )}
                      {report.expiresMonth != null && (
                        <small>有効期限: あと{Math.max(0, report.expiresMonth - month)}ヶ月</small>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
                        <input
                          type="number"
                          min="100"
                          step="100"
                          value={reportAmountValue}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setConsultationApplicationAmounts((current) => ({
                              ...current,
                              [report.id]: nextValue,
                            }));
                          }}
                          style={{ width: 110 }}
                        />
                        <span>万円</span>
                        <button
                          disabled={reportApplyAmount <= 0}
                          onClick={() => borrowFromBank(report.bankId, reportApplyAmount, report)}
                        >
                          {reportApplyAmount > 0 ? `${reportApplyAmount.toLocaleString()}万円で申請` : "申請不可"}
                        </button>
                      </div>
                      {defaultReportAmount > 0 && reportApplyAmount !== defaultReportAmount && (
                        <small>相談推奨額: {defaultReportAmount.toLocaleString()}万円</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <div className="detail-card">
      <h3>融資申請</h3>
      <p>融資は即日入金ではなく審査制です。申請自体は原則いつでも可能です。希望額が5,000万円未満なら1ヶ月、5,000万円以上なら2ヶ月、2億円以上なら3ヶ月後に結果が出ます。担当社員の営業・管理・統率によって、承認額や金利が変動します。</p>

      <div className="button-row">
        <label>
          借入希望額
          <input
            type="number"
            min="100"
            step="100"
            value={loanAmountInput}
            onChange={(event) => setLoanAmountInput(event.target.value)}
          />
          万円
        </label>
      </div>

      <div className="table-scroll">
        <table className="property-table">
          <thead>
            <tr>
              <th>銀行</th>
              <th>金利</th>
              <th>期間</th>
              <th>審査</th>
              <th>追加借入可能額</th>
              <th>希望額の月返済</th>
              <th>審査期間</th>
              <th>特徴</th>
              <th>申込</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(BANKS).map((bank) => {
              const capacity = loanCapacityByBank[bank.id];
              const amount = Math.max(0, Math.round(Number(loanAmountInput) || 0));
              const expectedPayment = calculateMonthlyLoanPayment(amount, bank.rate, bank.maxYears);
              const reviewMonths = getLoanReviewMonths(amount);
              const disabled = amount <= 0;
              const riskLabels = [];
              if (!capacity?.rankOk) riskLabels.push(`ランク目安:${bank.minRank}以上`);
              if (!capacity?.dscrOk) riskLabels.push("返済余力弱め");
              if (!capacity?.debtOk) riskLabels.push("借入比率高め");
              if (amount > (capacity?.remainingLimit ?? 0)) riskLabels.push("希望額が推定枠超過");
              const reason = riskLabels.length > 0
                ? `申請可 / ${riskLabels.join("・")}`
                : "申請可 / 見込み良好";

              return (
                <tr key={bank.id}>
                  <td>{bank.name}</td>
                  <td>{(bank.rate * 100).toFixed(1)}%</td>
                  <td>{bank.maxYears}年</td>
                  <td>{reason}</td>
                  <td>{(capacity?.remainingLimit ?? 0).toLocaleString()}万円</td>
                  <td>{expectedPayment.toLocaleString()}万円/月</td>
                  <td>{reviewMonths}ヶ月</td>
                  <td>{bank.description}</td>
                  <td>
                    <button
                      disabled={disabled}
                      onClick={() => borrowFromBank(bank.id)}
                    >
                      申請する
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>



    <div className="detail-card">
      <h3>審査中の融資申請</h3>
      {pendingLoanApplications.length === 0 ? (
        <p>現在、審査中の融資申請はありません。</p>
      ) : (
        <div className="table-scroll">
          <table className="property-table">
            <thead>
              <tr>
                <th>銀行</th>
                <th>申請時期</th>
                <th>希望額</th>
                <th>残り審査</th>
                <th>担当</th>
                <th>交渉力</th>
              </tr>
            </thead>
            <tbody>
              {pendingLoanApplications.map((application) => (
                <tr key={application.id}>
                  <td>{application.bankName}</td>
                  <td>{application.appliedAt || "-"}</td>
                  <td>{application.requestedAmount.toLocaleString()}万円</td>
                  <td>{application.monthsLeft}ヶ月</td>
                  <td>{(application.employeeNames ?? []).join("・") || "-"}</td>
                  <td>{application.negotiationPower}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    <div className="detail-card">
      <h3>借入一覧</h3>
      {loans.length === 0 ? (
        <p>現在の借入はありません。</p>
      ) : (
        <div className="table-scroll">
          <table className="property-table">
            <thead>
              <tr>
                <th>銀行</th>
                <th>借入時期</th>
                <th>当初借入</th>
                <th>残高</th>
                <th>金利</th>
                <th>残期間</th>
                <th>月返済</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td>{loan.bankName}</td>
                  <td>{loan.borrowedAt || "-"}</td>
                  <td>{loan.principal.toLocaleString()}万円</td>
                  <td>{loan.remaining.toLocaleString()}万円</td>
                  <td>{((loan.annualRate ?? 0) * 100).toFixed(1)}%</td>
                  <td>{loan.monthsLeft}ヶ月</td>
                  <td>{loan.monthlyPayment.toLocaleString()}万円</td>
                  <td>
                    <button
                      disabled={money < loan.remaining}
                      onClick={() => repayLoanEarly(loan.id)}
                    >
                      一括返済
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
)}

{activePanel === "info" && (
  <section className="property-section info-section">
    <h2>情報</h2>
    <div className="player-info-box v74-player-info-box">
      <h3>{playerCompanyName || DEFAULT_COMPANY_NAME}</h3>
      <div className="player-info-grid">
        <div>
          <span>所持金</span>
          <strong>{money.toLocaleString()}万円</strong>
        </div>
        <div>
          <span>総資産</span>
          <strong>{Math.round(money + assetValue).toLocaleString()}万円</strong>
        </div>
        <div>
          <span>現在</span>
          <strong>{gameDate.label}</strong>
        </div>
        <div>
          <span>経過</span>
          <strong>{month}ヶ月</strong>
        </div>
        <div>
          <span>ランク</span>
          <strong>{playerRank}</strong>
        </div>
        <div>
          <span>EXP</span>
          <strong>{playerExp} / {getPlayerRequiredExp(playerRank)}</strong>
        </div>
        <div>
          <span>人口</span>
          <strong>{totalPopulation.toLocaleString()}</strong>
        </div>
        <div>
          <span>社員</span>
          <strong>{employees.length}人 / 上限{employeeLimit}人</strong>
        </div>
        <div>
          <span>保管社員</span>
          <strong>{employeeStorage.length}人</strong>
        </div>
        <div>
          <span>支店</span>
          <strong>{branchCount}店</strong>
        </div>
        <div>
          <span>月利益</span>
          <strong>{monthlyProfit.toLocaleString()}万円</strong>
        </div>
      </div>
    </div>

    <h2>会社情報</h2>
    <div className="table-scroll">
      <table className="property-table">
        <thead>
          <tr>
            <th>詳細</th>
            <th>{renderCompanySortHeader("区分", "type")}</th>
            <th>{renderCompanySortHeader("会社名", "name")}</th>
            <th>{renderCompanySortHeader("現金", "money")}</th>
            <th>{renderCompanySortHeader("ランク", "rank")}</th>
            <th>{renderCompanySortHeader("月家賃", "rent")}</th>
            <th>{renderCompanySortHeader("月維持費", "maintenance")}</th>
            <th>{renderCompanySortHeader("月利益", "profit")}</th>
            <th>{renderCompanySortHeader("所有マス", "ownedTiles")}</th>
            <th>{renderCompanySortHeader("本社・支店", "offices")}</th>
            <th>{renderCompanySortHeader("建物数", "buildings")}</th>
            <th>{renderCompanySortHeader("社員数", "employees")}</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const playerBuildings = playerMainBuildings.filter((tile) => tile.building);
            const companyRows = [
              {
                id: "player",
                typeLabel: "自社",
                companyName: playerCompanyName || DEFAULT_COMPANY_NAME,
                money,
                rank: playerRank,
                rent: totalRent,
                maintenance: totalMaintenance,
                profit: monthlyProfit,
                ownedTiles: tiles.filter((tile) => tile.owner === OWNER.PLAYER).length,
                offices: officeTiles.length,
                buildings: playerBuildings,
                employeeCount: employees.length,
                employeeText: `${employees.length}人 / 保管${employeeStorage.length}人`,
                assetValue,
                employeesForModal: [
                  ...employees.map((employee) => ({
                    ...employee,
                    displayOfficeName: getCompanyEmployeeOfficeName(employee, false),
                    isStoredEmployee: false,
                  })),
                  ...employeeStorage.map((employee) => ({
                    ...employee,
                    displayOfficeName: "社員保管庫",
                    isStoredEmployee: true,
                  })),
                ],
                storageEmployeeIds: employeeStorage.map((employee) => employee.id),
              },
            ];

            Object.values(RIVAL_COMPANIES).forEach((company) => {
              const companyTiles = tiles.filter((tile) => tile.owner === OWNER.RIVAL && tile.rivalCompanyId === company.id);
              if (companyTiles.length === 0) return;

              const hqTile = companyTiles.find((tile) => tile.feature === FEATURE.HQ);
              const rivalOfficeTiles = companyTiles.filter((tile) => tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH);
              const getRivalEmployeeOfficeName = (employee) => {
                const officeId = employee?.officeId ?? "";

                if (String(officeId).includes("hq")) {
                  return hqTile?.rivalOfficeName ?? "本社";
                }

                const matchedOffice = rivalOfficeTiles.find((officeTile) => {
                  return officeTile.rivalOfficeId === officeId || officeTile.officeId === officeId;
                });

                if (matchedOffice) {
                  return matchedOffice.rivalOfficeName ?? matchedOffice.officeName ?? "支店";
                }

                return officeId ? "支店" : "本社";
              };
              const rivalEmployeesForDisplay = (hqTile?.rivalEmployees ?? []).map((employee) => ({
                ...employee,
                displayOfficeName: getRivalEmployeeOfficeName(employee),
                isStoredEmployee: false,
              }));
              const mainBuildings = companyTiles.filter((tile) => tile.building && !tile.buildingMainId);
              const rivalRent = mainBuildings.reduce((sum, tile) => {
                return sum + (tile.rooms ?? []).reduce((roomSum, room) => roomSum + (room.occupied ? room.rent ?? 0 : 0), 0);
              }, 0);
              const rivalPayroll = (hqTile?.rivalEmployees ?? []).reduce((sum, employee) => sum + (employee.salary ?? 0), 0);
              const rivalMaintenance = mainBuildings.reduce((sum, tile) => sum + calculateMonthlyExpenses(tile), 0) + rivalPayroll;
              const rivalProfit = rivalRent - rivalMaintenance;
              const rivalAssetValue = companyTiles.reduce((sum, tile) => {
                if (tile.buildingMainId) return sum;
                return sum + (tile.landPrice ?? 0) + (tile.building ? calculateBuildingValue(tile) : 0);
              }, 0);

              companyRows.push({
                id: company.id,
                typeLabel: "ライバル",
                companyName: hqTile?.rivalCompanyName ?? company.name,
                money: hqTile?.rivalMoney ?? company.initialMoney ?? 0,
                rank: hqTile?.rivalRank ?? 1,
                rent: rivalRent,
                maintenance: rivalMaintenance,
                profit: rivalProfit,
                ownedTiles: companyTiles.length,
                offices: rivalOfficeTiles.length,
                buildings: mainBuildings,
                employeeCount: rivalEmployeesForDisplay.length,
                employeeText: `${rivalEmployeesForDisplay.length}人`,
                assetValue: rivalAssetValue,
                employeesForModal: rivalEmployeesForDisplay,
                storageEmployeeIds: [],
              });
            });

            return sortCompanyRowsForDisplay(companyRows).map((row) => (
              <tr key={row.id}>
                <td><button onClick={() => setSelectedCompanyDetail(row.id)}>表示</button></td>
                <td>{row.typeLabel}</td>
                <td>{row.companyName}</td>
                <td>{row.money.toLocaleString()}万円</td>
                <td>{row.rank}</td>
                <td>{row.rent.toLocaleString()}万円</td>
                <td>{row.maintenance.toLocaleString()}万円</td>
                <td>{row.profit.toLocaleString()}万円</td>
                <td>{row.ownedTiles}</td>
                <td>{row.offices}</td>
                <td>
                  <button
                    className="employee-count-link-button"
                    onClick={() => setCompanyBuildingListModal({
                      companyName: row.companyName,
                      buildings: row.buildings,
                    })}
                  >
                    {row.buildings.length}棟
                  </button>
                </td>
                <td>
                  <button
                    className="employee-count-link-button"
                    onClick={() => setCompanyEmployeeListModal({
                      companyName: row.companyName,
                      employees: row.employeesForModal,
                      storageEmployeeIds: row.storageEmployeeIds,
                    })}
                  >
                    {row.employeeText}
                  </button>
                </td>
              </tr>
            ));
          })()}
        </tbody>
      </table>
    </div>

    {selectedCompanyDetail && (
      <div className="company-detail-box">
        <h3>{selectedCompanyDetail === "player" ? "自社詳細" : `${getRivalCompanyNameFromTiles(tiles, selectedCompanyDetail)} 詳細`}</h3>
        <button onClick={() => setSelectedCompanyDetail(null)}>詳細を閉じる</button>
        <h4>月次推移</h4>
        <div className="line-chart-box">
          {(() => {
            const chartRecords = [...monthlyCompanyHistory.slice(0, 12)].reverse();
            if (chartRecords.length === 0) {
              return <p>月次推移はまだありません。</p>;
            }

            const values = chartRecords.map((record) => record.net ?? 0);
            const minValue = Math.min(...values, 0);
            const maxValue = Math.max(...values, 1);
            const range = Math.max(1, maxValue - minValue);
            const points = values.map((value, index) => {
              const x = chartRecords.length === 1 ? 50 : (index / (chartRecords.length - 1)) * 100;
              const y = 90 - ((value - minValue) / range) * 80;
              return `${x},${y}`;
            }).join(" ");

            return (
              <>
                <svg className="line-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={points} className="line-chart-polyline" />
                </svg>
                <div className="line-chart-labels">
                  {chartRecords.map((record) => (
                    <span key={record.label}>{record.label}<br />{record.net}万円</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <h4>年次推移</h4>
        <div className="line-chart-box">
          {(() => {
            const chartRecords = [...annualReportHistory.slice(-8)];
            if (chartRecords.length === 0) {
              return <p>年次推移はまだありません。</p>;
            }

            const values = chartRecords.map((record) => record.netAfterTax ?? record.net ?? 0);
            const minValue = Math.min(...values, 0);
            const maxValue = Math.max(...values, 1);
            const range = Math.max(1, maxValue - minValue);
            const points = values.map((value, index) => {
              const x = chartRecords.length === 1 ? 50 : (index / (chartRecords.length - 1)) * 100;
              const y = 90 - ((value - minValue) / range) * 80;
              return `${x},${y}`;
            }).join(" ");

            return (
              <>
                <svg className="line-chart-svg annual-line-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={points} className="line-chart-polyline annual-line-chart-polyline" />
                </svg>
                <div className="line-chart-labels annual-line-chart-labels">
                  {chartRecords.map((record) => (
                    <span key={record.yearLabel}>{record.yearLabel}<br />{record.netAfterTax ?? record.net}万円</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <h4>決算履歴</h4>
        <div className="table-scroll">
          <table className="property-table">
            <thead>
              <tr><th>年度</th><th>家賃収入</th><th>維持費</th><th>法人税等</th><th>税引後利益</th><th>期末現金</th></tr>
            </thead>
            <tbody>
              {annualReportHistory.length === 0 ? (
                <tr><td colSpan="6">決算履歴はまだありません。</td></tr>
              ) : annualReportHistory.map((report) => (
                <tr key={report.yearLabel}>
                  <td>{report.yearLabel}</td>
                  <td>{report.income}万円</td>
                  <td>{report.maintenance}万円</td>
                  <td>{report.corporateTax ?? 0}万円</td>
                  <td>{report.netAfterTax ?? report.net}万円</td>
                  <td>{report.money}万円</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </section>
)}

{activePanel === "property" && (
        <section className="side-section">
          <section className="property-section">
            <h2>所有物件一覧</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>座標</th>
                    <th>建物</th>
                    <th>部屋数</th>
                    <th>入居数</th>
                    <th>入居人数</th>
                    <th>稼働率</th>
                    <th>月家賃</th>
                    <th>月維持費</th>
                    <th>固定資産税/月割</th>
                    <th>月利益</th>
                  </tr>
                </thead>
                <tbody>
                 {playerMainBuildings.map((tile) => {

  const building =
    tile.building
      ? BUILDINGS[tile.building]
      : {
          name: tile.hqName || "本社",
          rooms: 0,
          cost: tile.hqCost || 0,
        };

  const occupiedRooms = (tile.rooms ?? []).filter(
  (room) => room.occupied
);

const people = occupiedRooms.reduce(
  (sum, room) => sum + room.people,
  0
);

const rent = occupiedRooms.reduce(
  (sum, room) => sum + room.rent,
  0
);
                    const monthlyExpense = tile.building
  ? calculateMonthlyExpenses(tile)
  : 0;
                    const yearlyPropertyTax = calculateYearlyPropertyTax(tile);
                    const monthlyTax = Math.round(yearlyPropertyTax / 12);
                    const profit = rent - monthlyExpense - monthlyTax;
                    const rate = tile.rooms.length
                      ? Math.round((occupiedRooms.length / tile.rooms.length) * 100)
                      : 0;

                    return (
                      <tr
                        key={tile.id}
                        onClick={() => {
                          selectBuildingFromList(tile.id);
                          setActivePanel("land");
                        }}
                        className="clickable-row"
                      >
                        <td>{tile.x},{tile.y}</td>
                        <td>{building.name}</td>
                        <td>{tile.rooms.length}</td>
                        <td>{occupiedRooms.length}</td>
                        <td>{people}</td>
                        <td>{rate}%</td>
                        <td>{rent}万円</td>
                        <td>{monthlyExpense}万円</td>
                        <td>{monthlyTax}万円</td>
                        <td>{profit}万円</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

{activePanel === "option" && (
  <section className="side-section">
    <section className="log-section">
      <h2>オプション</h2>

      <button onClick={newGame}>
        マップリセット（社員は残す）
      </button>

      <button onClick={fullResetGame}>
        全データリセット（社員も削除）
      </button>

      <button onClick={turnBgmOn}>
        BGM ON
      </button>

      <button onClick={turnBgmOff}>
        BGM OFF
      </button>

      <button onClick={() => setSaveLoadModal("save")}>
        セーブ
      </button>

      <button onClick={() => setSaveLoadModal("load")}>
        ロード
      </button>

      <button onClick={returnToTitleScreen}>
        タイトルメニューへ戻る
      </button>

      <button onClick={() => setShowDeveloperCommand((current) => !current)}>
        開発者用
      </button>

      {showDeveloperCommand && (
        <div className="developer-command-box">
          <input
            type="text"
            value={developerCommandInput}
            onChange={(event) => setDeveloperCommandInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleDeveloperCommand();
              }
            }}
          />
          <button onClick={handleDeveloperCommand}>OK</button>
        </div>
      )}

    </section>
  </section>
)}


{saveLoadModal && (
  <div className="popup-log">
    <div className="popup-log-card" style={{ maxWidth: "min(94vw, 620px)" }}>
      <h3>{saveLoadModal === "save" ? "セーブ" : "ロード"}</h3>
      <p style={{ marginTop: 0, opacity: 0.78 }}>
        {saveLoadModal === "save"
          ? "保存先スロットを選んでください。既存データがある場合は上書きされます。"
          : "読み込むセーブデータを選んでください。選択したスロットの内容をこの画面へ読み込みます。"}
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {saveSlotSummaries.map((slotInfo) => (
          <div
            key={slotInfo.slot}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,0.92)",
              color: "#1d2b22",
              border: activeSaveSlot === slotInfo.slot ? "2px solid #1d5c3a" : "1px solid rgba(29,92,58,0.18)",
            }}
          >
            <div>
              <strong>スロット{slotInfo.slot}</strong>
              {activeSaveSlot === slotInfo.slot ? "（現在）" : ""}
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {slotInfo.hasData
                  ? `${slotInfo.companyName} / ${getGameDate(slotInfo.month).label} / ${Number(slotInfo.money ?? 0).toLocaleString()}万円`
                  : "空きスロット"}
              </div>
              {slotInfo.hasData && (
                <div style={{ fontSize: 12, opacity: 0.72, marginTop: 2 }}>保存：{slotInfo.savedAtText}</div>
              )}
            </div>
            {saveLoadModal === "save" ? (
              <button
                type="button"
                onClick={() => {
                  const ok = !slotInfo.hasData || window.confirm(`スロット${slotInfo.slot}に上書き保存しますか？`);
                  if (!ok) return;
                  saveCurrentGameToSlot(slotInfo.slot);
                  setSaveLoadModal(null);
                }}
              >
                保存する
              </button>
            ) : (
              <button
                type="button"
                disabled={!slotInfo.hasData}
                onClick={() => loadSaveSlotFromTitle(slotInfo.slot)}
                style={{ opacity: slotInfo.hasData ? 1 : 0.45, cursor: slotInfo.hasData ? "pointer" : "not-allowed" }}
              >
                ロードする
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setSaveLoadModal(null)} style={{ marginTop: 14, width: "100%" }}>
        閉じる
      </button>
    </div>
  </div>
)}

      {activePanel === "log" && (
        <section className="side-section">
          <section className="log-section">
            <h2>ログ</h2>
            {logHistory.length === 0 ? (
              <p>{log}</p>
            ) : (
              <div className="log-list">
                {logHistory.map((item, index) => (
                  <pre key={index} className="log-item">
                    {item}
                  </pre>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      </main>
    </div>
  </>
);
}

