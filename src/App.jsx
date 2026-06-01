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
    initialMoney: 15000,
  },
  B: {
    id: "B",
    name: "紫苑リアルティ",
    colorClass: "rival-company-b-tile",
    rangeClass: "rival-company-b-range-tile",
    colorName: "緑",
    initialMoney: 20000,
  },
};

function getRivalCompany(companyId) {
  return RIVAL_COMPANIES[companyId] ?? RIVAL_COMPANIES.A;
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
    name: "アパート付きRC造本社",
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
    name: "一般本社RC造",
    short: "本",

    cost: 3000,
    rooms: 0,
  },

  apartment: {
    name: "アパート付きRC造本社",
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
name: "森 誠",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 34,
construction: 37,
management: 45,
salary: 19,
specialNames: []
},

{
id: 2,
name: "神谷 陽介",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 28,
construction: 38,
management: 41,
salary: 26,
specialNames: []
},

{
id: 3,
name: "市川 凛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 44,
construction: 40,
management: 45,
salary: 21,
specialNames: [
"飽き性",
]
},

{
id: 4,
name: "千葉 美穂",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 40,
construction: 26,
management: 35,
salary: 30,
specialNames: [
"飽き性",
]
},

{
id: 5,
name: "斎藤 誠",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 40,
construction: 34,
management: 31,
salary: 27,
specialNames: [
"現場嫌い",
]
},

{
id: 6,
name: "内藤 翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 40,
construction: 39,
management: 33,
salary: 20,
specialNames: [
"慎重すぎる",
]
},

{
id: 7,
name: "水野 樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 40,
construction: 44,
management: 29,
salary: 27,
specialNames: []
},

{
id: 8,
name: "川崎 花子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 44,
construction: 25,
management: 33,
salary: 30,
specialNames: []
},

{
id: 9,
name: "片山 仁",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 38,
construction: 45,
management: 44,
salary: 18,
specialNames: []
},

{
id: 10,
name: "久保田 悠人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 32,
construction: 35,
management: 44,
salary: 21,
specialNames: []
},

{
id: 11,
name: "上田 隆弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 29,
construction: 34,
management: 36,
salary: 18,
specialNames: [
"遅刻癖",
]
},

{
id: 12,
name: "浅井 太一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 32,
construction: 42,
management: 38,
salary: 27,
specialNames: [
"見栄っ張り",
]
},

{
id: 13,
name: "ミラー ナタリー",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 44,
construction: 30,
management: 36,
salary: 24,
specialNames: []
},

{
id: 14,
name: "岩田 さくら",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 40,
construction: 28,
management: 42,
salary: 22,
specialNames: [
"報連相不足",
]
},

{
id: 15,
name: "田中 海斗",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 25,
construction: 27,
management: 25,
salary: 27,
specialNames: [
"遅刻癖",
]
},

{
id: 16,
name: "酒井 祐奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 32,
construction: 25,
management: 30,
salary: 29,
specialNames: [
"気分屋",
]
},

{
id: 17,
name: "松田 早苗",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 40,
construction: 41,
management: 45,
salary: 30,
specialNames: []
},

{
id: 18,
name: "小林 一樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 37,
construction: 33,
management: 25,
salary: 21,
specialNames: [
"浪費家",
]
},

{
id: 19,
name: "新井 莉子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 40,
construction: 40,
management: 40,
salary: 18,
specialNames: [
"見栄っ張り",
]
},

{
id: 20,
name: "竹田 琴音",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 31,
construction: 37,
management: 41,
salary: 17,
specialNames: [
"抱え込み",
]
},

{
id: 21,
name: "藤田 佳奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 45,
construction: 37,
management: 44,
salary: 30,
specialNames: [
"設備音痴",
]
},

{
id: 22,
name: "丹羽 源",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 27,
construction: 43,
management: 39,
salary: 22,
specialNames: [
"朝が弱い",
]
},

{
id: 23,
name: "内藤 朝陽",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 45,
construction: 45,
management: 43,
salary: 21,
specialNames: []
},

{
id: 24,
name: "榊原 心春",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 40,
construction: 27,
management: 41,
salary: 21,
specialNames: [
"交渉下手",
]
},

{
id: 25,
name: "神谷 夏帆",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 27,
construction: 41,
management: 43,
salary: 19,
specialNames: [
"慎重すぎる",
]
},

{
id: 26,
name: "宮本 慎吾",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 25,
construction: 31,
management: 43,
salary: 23,
specialNames: []
},

{
id: 27,
name: "藤原 健二",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 38,
construction: 30,
management: 38,
salary: 21,
specialNames: [
"抱え込み",
]
},

{
id: 28,
name: "青木 愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 37,
construction: 29,
management: 45,
salary: 27,
specialNames: [
"交渉下手",
]
},

{
id: 29,
name: "浅井 遥",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 44,
construction: 35,
management: 41,
salary: 30,
specialNames: [
"気分屋",
]
},

{
id: 30,
name: "水野 結衣",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 44,
construction: 44,
management: 38,
salary: 15,
specialNames: []
},

{
id: 31,
name: "辻 祐奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 36,
construction: 39,
management: 39,
salary: 24,
specialNames: []
},

{
id: 32,
name: "鈴木 達也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 25,
construction: 45,
management: 25,
salary: 21,
specialNames: [
"抱え込み",
]
},

{
id: 33,
name: "西村 透",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 39,
construction: 36,
management: 42,
salary: 21,
specialNames: [
"数字が苦手",
]
},

{
id: 34,
name: "稲垣 亜美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 36,
construction: 34,
management: 27,
salary: 21,
specialNames: [
"整理下手",
]
},

{
id: 35,
name: "内田 陽介",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 36,
construction: 45,
management: 40,
salary: 27,
specialNames: [
"整理下手",
]
},

{
id: 36,
name: "尾崎 早苗",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 30,
construction: 36,
management: 37,
salary: 19,
specialNames: [
"朝が弱い",
]
},

{
id: 37,
name: "シュミット ハナ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 38,
construction: 36,
management: 26,
salary: 17,
specialNames: []
},

{
id: 38,
name: "ブラウン アレックス",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 31,
construction: 29,
management: 43,
salary: 21,
specialNames: []
},

{
id: 39,
name: "水谷 大地",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 37,
construction: 45,
management: 32,
salary: 17,
specialNames: [
"詰めが甘い",
]
},

{
id: 40,
name: "片岡 奈々",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 36,
construction: 35,
management: 27,
salary: 15,
specialNames: [
"慎重すぎる",
]
},

{
id: 41,
name: "内藤 美琴",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 44,
construction: 25,
management: 36,
salary: 15,
specialNames: [
"飽き性",
]
},

{
id: 42,
name: "森 亜美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 45,
construction: 29,
management: 43,
salary: 24,
specialNames: []
},

{
id: 43,
name: "松井 慶太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 41,
construction: 36,
management: 44,
salary: 27,
specialNames: [
"空回り",
]
},

{
id: 44,
name: "西田 陽菜",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 42,
construction: 40,
management: 31,
salary: 27,
specialNames: [
"押しが弱い",
]
},

{
id: 45,
name: "榊原 柚葉",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 45,
construction: 40,
management: 31,
salary: 27,
specialNames: []
},

{
id: 46,
name: "東 葵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 25,
construction: 27,
management: 41,
salary: 16,
specialNames: []
},

{
id: 47,
name: "永井 綾乃",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 28,
construction: 39,
management: 45,
salary: 18,
specialNames: []
},

{
id: 48,
name: "松田 颯太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 30,
construction: 33,
management: 32,
salary: 16,
specialNames: [
"気分屋",
]
},

{
id: 49,
name: "畑中 紬",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 29,
construction: 36,
management: 27,
salary: 20,
specialNames: []
},

{
id: 50,
name: "久保田 修",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 34,
construction: 43,
management: 40,
salary: 24,
specialNames: [
"飽き性",
]
},

{
id: 51,
name: "ガルシア オリバー",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 39,
construction: 29,
management: 36,
salary: 16,
specialNames: []
},

{
id: 52,
name: "早川 湊",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 44,
construction: 37,
management: 37,
salary: 18,
specialNames: []
},

{
id: 53,
name: "内藤 彩乃",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 35,
construction: 29,
management: 43,
salary: 30,
specialNames: [
"短気",
]
},

{
id: 54,
name: "山口 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 35,
construction: 43,
management: 42,
salary: 19,
specialNames: [
"短気",
]
},

{
id: 55,
name: "服部 梨花",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 35,
construction: 41,
management: 45,
salary: 25,
specialNames: [
"設備音痴",
]
},

{
id: 56,
name: "川口 美月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 33,
construction: 27,
management: 38,
salary: 15,
specialNames: [
"朝が弱い",
]
},

{
id: 57,
name: "ビアンキ アレックス",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 36,
construction: 36,
management: 25,
salary: 20,
specialNames: []
},

{
id: 58,
name: "吉村 美穂",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 39,
construction: 39,
management: 44,
salary: 22,
specialNames: []
},

{
id: 59,
name: "水谷 義弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 39,
construction: 45,
management: 32,
salary: 30,
specialNames: [
"慎重すぎる",
]
},

{
id: 60,
name: "中川 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 45,
construction: 25,
management: 34,
salary: 15,
specialNames: [
"設備音痴",
]
},

{
id: 61,
name: "パク ダニエル",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 43,
construction: 33,
management: 29,
salary: 19,
specialNames: [
"空回り",
]
},

{
id: 62,
name: "小松 美和",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 25,
construction: 39,
management: 45,
salary: 29,
specialNames: []
},

{
id: 63,
name: "久保 修",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 41,
construction: 27,
management: 44,
salary: 21,
specialNames: [
"短気",
]
},

{
id: 64,
name: "工藤 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 30,
construction: 34,
management: 30,
salary: 26,
specialNames: []
},

{
id: 65,
name: "斎藤 里奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 38,
construction: 33,
management: 45,
salary: 23,
specialNames: []
},

{
id: 66,
name: "水野 美月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 35,
construction: 27,
management: 35,
salary: 19,
specialNames: [
"空回り",
]
},

{
id: 67,
name: "伊藤 明日香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 31,
construction: 29,
management: 34,
salary: 30,
specialNames: []
},

{
id: 68,
name: "近藤 菜月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 41,
construction: 28,
management: 39,
salary: 15,
specialNames: []
},

{
id: 69,
name: "森本 杏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 32,
construction: 25,
management: 45,
salary: 20,
specialNames: []
},

{
id: 70,
name: "田島 千尋",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 45,
construction: 35,
management: 32,
salary: 15,
specialNames: []
},

{
id: 71,
name: "渡辺 達也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 31,
construction: 27,
management: 39,
salary: 24,
specialNames: [
"整理下手",
]
},

{
id: 72,
name: "ガルシア リー",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 27,
construction: 45,
management: 35,
salary: 19,
specialNames: [
"報連相不足",
]
},

{
id: 73,
name: "中村 遼",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 38,
construction: 37,
management: 32,
salary: 28,
specialNames: [
"気分屋",
]
},

{
id: 74,
name: "石井 真央",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 37,
construction: 37,
management: 37,
salary: 28,
specialNames: []
},

{
id: 75,
name: "中山 真由",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 43,
construction: 25,
management: 30,
salary: 30,
specialNames: []
},

{
id: 76,
name: "山口 帆波",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 26,
construction: 33,
management: 45,
salary: 29,
specialNames: [
"浪費家",
]
},

{
id: 77,
name: "三浦 直美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 45,
construction: 34,
management: 28,
salary: 25,
specialNames: []
},

{
id: 78,
name: "林 美月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 38,
construction: 33,
management: 30,
salary: 24,
specialNames: [
"遅刻癖",
]
},

{
id: 79,
name: "永井 美咲",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 41,
construction: 39,
management: 44,
salary: 21,
specialNames: [
"朝が弱い",
]
},

{
id: 80,
name: "石井 美和",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 35,
construction: 38,
management: 33,
salary: 18,
specialNames: []
},

{
id: 81,
name: "滝沢 陽菜",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 25,
construction: 44,
management: 42,
salary: 26,
specialNames: []
},

{
id: 82,
name: "浅井 智子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 45,
construction: 38,
management: 38,
salary: 17,
specialNames: [
"見栄っ張り",
]
},

{
id: 83,
name: "デイビス サミュエル",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 42,
construction: 43,
management: 25,
salary: 17,
specialNames: []
},

{
id: 84,
name: "小松 久美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 31,
construction: 37,
management: 41,
salary: 16,
specialNames: []
},

{
id: 85,
name: "尾崎 由佳",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 38,
construction: 25,
management: 34,
salary: 23,
specialNames: [
"短気",
]
},

{
id: 86,
name: "坂本 友香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 28,
construction: 36,
management: 29,
salary: 26,
specialNames: [
"気分屋",
]
},

{
id: 87,
name: "高島 光一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 26,
construction: 30,
management: 41,
salary: 21,
specialNames: []
},

{
id: 88,
name: "和田 真央",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 25,
construction: 30,
management: 31,
salary: 20,
specialNames: []
},

{
id: 89,
name: "酒井 絵里",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 25,
construction: 34,
management: 45,
salary: 22,
specialNames: [
"交渉下手",
]
},

{
id: 90,
name: "土屋 慶太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 32,
construction: 31,
management: 25,
salary: 25,
specialNames: []
},

{
id: 91,
name: "ミュラー アンナ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 25,
construction: 40,
management: 45,
salary: 24,
specialNames: []
},

{
id: 92,
name: "小島 春香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 32,
construction: 45,
management: 29,
salary: 30,
specialNames: [
"飽き性",
]
},

{
id: 93,
name: "山崎 颯太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 32,
construction: 35,
management: 40,
salary: 29,
specialNames: []
},

{
id: 94,
name: "小池 美和",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 25,
construction: 31,
management: 39,
salary: 24,
specialNames: []
},

{
id: 95,
name: "平野 恵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 35,
construction: 42,
management: 27,
salary: 19,
specialNames: [
"遅刻癖",
]
},

{
id: 96,
name: "中川 仁",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 45,
construction: 27,
management: 31,
salary: 24,
specialNames: [
"見栄っ張り",
]
},

{
id: 97,
name: "島田 誠",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 30,
construction: 42,
management: 25,
salary: 16,
specialNames: [
"押しが弱い",
]
},

{
id: 98,
name: "上田 修",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 32,
construction: 32,
management: 26,
salary: 21,
specialNames: []
},

{
id: 99,
name: "古川 佳奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 26,
construction: 28,
management: 45,
salary: 19,
specialNames: [
"詰めが甘い",
]
},

{
id: 100,
name: "吉村 匠",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 25,
construction: 40,
management: 33,
salary: 19,
specialNames: []
},

{
id: 101,
name: "藤本 義弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 28,
construction: 32,
management: 28,
salary: 26,
specialNames: []
},

{
id: 102,
name: "坂口 修",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 37,
construction: 25,
management: 38,
salary: 23,
specialNames: [
"朝が弱い",
]
},

{
id: 103,
name: "森 美穂",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 39,
construction: 27,
management: 35,
salary: 21,
specialNames: [
"慎重すぎる",
]
},

{
id: 104,
name: "安藤 景子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 39,
construction: 42,
management: 42,
salary: 19,
specialNames: []
},

{
id: 105,
name: "後藤 晴翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 31,
construction: 42,
management: 40,
salary: 20,
specialNames: [
"遅刻癖",
]
},

{
id: 106,
name: "竹内 英明",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 37,
construction: 45,
management: 35,
salary: 16,
specialNames: [
"見栄っ張り",
]
},

{
id: 107,
name: "若松 香織",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 30,
construction: 44,
management: 42,
salary: 30,
specialNames: []
},

{
id: 108,
name: "岡田 啓太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 25,
construction: 33,
management: 43,
salary: 30,
specialNames: []
},

{
id: 109,
name: "河合 遥",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 31,
construction: 33,
management: 29,
salary: 27,
specialNames: []
},

{
id: 110,
name: "若松 英明",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 35,
construction: 37,
management: 43,
salary: 27,
specialNames: [
"短気",
]
},

{
id: 111,
name: "杉浦 智久",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 40,
construction: 32,
management: 30,
salary: 26,
specialNames: [
"慎重すぎる",
]
},

{
id: 112,
name: "山内 菜月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 26,
construction: 34,
management: 36,
salary: 22,
specialNames: [
"書類ミス",
]
},

{
id: 113,
name: "後藤 悠人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 34,
construction: 45,
management: 25,
salary: 29,
specialNames: [
"抱え込み",
]
},

{
id: 114,
name: "服部 大地",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 27,
construction: 40,
management: 35,
salary: 23,
specialNames: []
},

{
id: 115,
name: "堀田 裕子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 39,
construction: 25,
management: 31,
salary: 25,
specialNames: []
},

{
id: 116,
name: "平田 友香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 30,
construction: 35,
management: 28,
salary: 18,
specialNames: []
},

{
id: 117,
name: "藤田 伸一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 33,
construction: 31,
management: 25,
salary: 29,
specialNames: []
},

{
id: 118,
name: "川口 彩香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 33,
construction: 30,
management: 32,
salary: 16,
specialNames: [
"詰めが甘い",
]
},

{
id: 119,
name: "堀 雄大",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 33,
construction: 29,
management: 31,
salary: 16,
specialNames: [
"詰めが甘い",
]
},

{
id: 120,
name: "榊原 玲奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 42,
construction: 42,
management: 45,
salary: 23,
specialNames: []
},

{
id: 121,
name: "リー マリア",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 36,
construction: 45,
management: 34,
salary: 26,
specialNames: [
"押しが弱い",
]
},

{
id: 122,
name: "林 恵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 34,
construction: 32,
management: 45,
salary: 15,
specialNames: []
},

{
id: 123,
name: "小川 智久",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 44,
construction: 45,
management: 40,
salary: 23,
specialNames: []
},

{
id: 124,
name: "谷口 紀子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 37,
construction: 25,
management: 34,
salary: 28,
specialNames: [
"数字が苦手",
]
},

{
id: 125,
name: "上田 絵里",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 25,
construction: 42,
management: 44,
salary: 25,
specialNames: [
"飽き性",
]
},

{
id: 126,
name: "桜井 義弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 33,
construction: 45,
management: 32,
salary: 25,
specialNames: []
},

{
id: 127,
name: "高木 慶太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 27,
construction: 45,
management: 25,
salary: 21,
specialNames: []
},

{
id: 128,
name: "清水 真由",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 44,
construction: 32,
management: 40,
salary: 26,
specialNames: [
"浪費家",
]
},

{
id: 129,
name: "橋本 実咲",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 42,
construction: 25,
management: 34,
salary: 19,
specialNames: []
},

{
id: 130,
name: "山田 実咲",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 42,
construction: 33,
management: 32,
salary: 18,
specialNames: [
"見栄っ張り",
]
},

{
id: 131,
name: "山田 直樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 45,
construction: 32,
management: 25,
salary: 28,
specialNames: []
},

{
id: 132,
name: "森田 慶太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 45,
construction: 29,
management: 41,
salary: 24,
specialNames: []
},

{
id: 133,
name: "小川 紀子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 45,
construction: 27,
management: 28,
salary: 20,
specialNames: []
},

{
id: 134,
name: "マルティン クリス",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 28,
construction: 32,
management: 30,
salary: 30,
specialNames: [
"浪費家",
]
},

{
id: 135,
name: "竹内 直人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 40,
construction: 41,
management: 33,
salary: 27,
specialNames: []
},

{
id: 136,
name: "リー アンナ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 35,
construction: 27,
management: 27,
salary: 21,
specialNames: [
"短気",
]
},

{
id: 137,
name: "杉浦 大輔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 34,
construction: 41,
management: 37,
salary: 20,
specialNames: [
"朝が弱い",
]
},

{
id: 138,
name: "若松 良",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 43,
construction: 39,
management: 36,
salary: 15,
specialNames: []
},

{
id: 139,
name: "石井 義弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 43,
construction: 44,
management: 27,
salary: 21,
specialNames: []
},

{
id: 140,
name: "山下 学",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 32,
construction: 45,
management: 39,
salary: 16,
specialNames: [
"遅刻癖",
]
},

{
id: 141,
name: "大西 美琴",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 35,
construction: 31,
management: 26,
salary: 16,
specialNames: []
},

{
id: 142,
name: "近藤 杏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 41,
construction: 30,
management: 45,
salary: 21,
specialNames: []
},

{
id: 143,
name: "リー ミア",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 36,
construction: 45,
management: 25,
salary: 25,
specialNames: [
"遅刻癖",
]
},

{
id: 144,
name: "飯田 春香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 39,
construction: 34,
management: 34,
salary: 22,
specialNames: [
"報連相不足",
]
},

{
id: 145,
name: "林 伸一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 37,
construction: 43,
management: 36,
salary: 23,
specialNames: [
"抱え込み",
]
},

{
id: 146,
name: "菅原 奈々",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 37,
construction: 39,
management: 29,
salary: 18,
specialNames: [
"詰めが甘い",
]
},

{
id: 147,
name: "加藤 大地",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 40,
construction: 35,
management: 32,
salary: 18,
specialNames: [
"空回り",
]
},

{
id: 148,
name: "佐野 琴音",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 35,
construction: 42,
management: 33,
salary: 27,
specialNames: []
},

{
id: 149,
name: "武田 琴音",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 43,
construction: 37,
management: 42,
salary: 24,
specialNames: []
},

{
id: 150,
name: "山本 柚葉",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 38,
construction: 43,
management: 36,
salary: 19,
specialNames: [
"整理下手",
]
},

{
id: 151,
name: "永田 蒼空",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 39,
construction: 33,
management: 27,
salary: 15,
specialNames: []
},

{
id: 152,
name: "小松 春香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 32,
construction: 25,
management: 27,
salary: 24,
specialNames: []
},

{
id: 153,
name: "杉山 真希",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 42,
construction: 41,
management: 44,
salary: 28,
specialNames: []
},

{
id: 154,
name: "福島 翔太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 43,
construction: 45,
management: 25,
salary: 28,
specialNames: [
"数字が苦手",
]
},

{
id: 155,
name: "神谷 希",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 43,
construction: 36,
management: 33,
salary: 20,
specialNames: []
},

{
id: 156,
name: "藤原 莉子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 39,
construction: 44,
management: 29,
salary: 26,
specialNames: [
"設備音痴",
]
},

{
id: 157,
name: "谷口 健二",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 27,
construction: 31,
management: 31,
salary: 24,
specialNames: []
},

{
id: 158,
name: "福田 達也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 37,
construction: 45,
management: 44,
salary: 19,
specialNames: []
},

{
id: 159,
name: "後藤 友香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 27,
construction: 27,
management: 38,
salary: 29,
specialNames: [
"浪費家",
]
},

{
id: 160,
name: "島田 朝陽",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 30,
construction: 41,
management: 31,
salary: 26,
specialNames: [
"整理下手",
]
},

{
id: 161,
name: "中山 久美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 31,
construction: 40,
management: 31,
salary: 16,
specialNames: [
"抱え込み",
]
},

{
id: 162,
name: "増田 遼",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 38,
construction: 45,
management: 43,
salary: 23,
specialNames: []
},

{
id: 163,
name: "千葉 楓",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 40,
construction: 32,
management: 30,
salary: 22,
specialNames: [
"設備音痴",
]
},

{
id: 164,
name: "川上 源",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 27,
construction: 29,
management: 33,
salary: 19,
specialNames: [
"整理下手",
]
},

{
id: 165,
name: "福田 隆弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 29,
construction: 44,
management: 31,
salary: 21,
specialNames: [
"設備音痴",
]
},

{
id: 166,
name: "ロッシ ミア",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 34,
construction: 38,
management: 45,
salary: 21,
specialNames: [
"見栄っ張り",
]
},

{
id: 167,
name: "渡部 次郎",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 43,
construction: 31,
management: 25,
salary: 26,
specialNames: []
},

{
id: 168,
name: "小松 健吾",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 29,
construction: 36,
management: 26,
salary: 15,
specialNames: []
},

{
id: 169,
name: "藤本 凛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 25,
construction: 38,
management: 37,
salary: 21,
specialNames: [
"詰めが甘い",
]
},

{
id: 170,
name: "西田 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 45,
construction: 36,
management: 37,
salary: 15,
specialNames: [
"押しが弱い",
]
},

{
id: 171,
name: "渡辺 裕子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 34,
construction: 32,
management: 25,
salary: 25,
specialNames: [
"見栄っ張り",
]
},

{
id: 172,
name: "服部 遥",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 39,
construction: 36,
management: 37,
salary: 27,
specialNames: [
"空回り",
]
},

{
id: 173,
name: "畑中 朝陽",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 25,
construction: 45,
management: 36,
salary: 17,
specialNames: [
"見栄っ張り",
]
},

{
id: 174,
name: "高木 美和",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 40,
construction: 45,
management: 42,
salary: 17,
specialNames: []
},

{
id: 175,
name: "榊原 大地",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 29,
construction: 43,
management: 43,
salary: 18,
specialNames: [
"遅刻癖",
]
},

{
id: 176,
name: "渡部 信也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 35,
construction: 32,
management: 34,
salary: 30,
specialNames: [
"交渉下手",
]
},

{
id: 177,
name: "佐藤 さくら",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 28,
construction: 42,
management: 45,
salary: 22,
specialNames: []
},

{
id: 178,
name: "野口 三郎",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 39,
construction: 31,
management: 42,
salary: 21,
specialNames: []
},

{
id: 179,
name: "北村 忠司",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 39,
construction: 36,
management: 28,
salary: 17,
specialNames: []
},

{
id: 180,
name: "高田 由佳",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 43,
construction: 28,
management: 31,
salary: 30,
specialNames: [
"詰めが甘い",
]
},

{
id: 181,
name: "東 悠人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 40,
construction: 39,
management: 31,
salary: 15,
specialNames: []
},

{
id: 182,
name: "阿部 剛",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 30,
construction: 45,
management: 36,
salary: 20,
specialNames: []
},

{
id: 183,
name: "和田 静香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 37,
construction: 37,
management: 45,
salary: 21,
specialNames: []
},

{
id: 184,
name: "高田 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 42,
construction: 30,
management: 42,
salary: 27,
specialNames: []
},

{
id: 185,
name: "宮崎 久美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 34,
construction: 25,
management: 35,
salary: 19,
specialNames: [
"気分屋",
]
},

{
id: 186,
name: "松井 芽衣",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 41,
construction: 41,
management: 31,
salary: 20,
specialNames: []
},

{
id: 187,
name: "渡部 美月",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 29,
construction: 25,
management: 35,
salary: 19,
specialNames: []
},

{
id: 188,
name: "加藤 千夏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 32,
construction: 44,
management: 29,
salary: 18,
specialNames: [
"数字が苦手",
]
},

{
id: 189,
name: "阿部 結衣",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 40,
construction: 25,
management: 45,
salary: 17,
specialNames: [
"朝が弱い",
]
},

{
id: 190,
name: "岡崎 清隆",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 42,
construction: 43,
management: 39,
salary: 23,
specialNames: [
"数字が苦手",
]
},

{
id: 191,
name: "川村 悠人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 33,
construction: 34,
management: 25,
salary: 28,
specialNames: [
"短気",
]
},

{
id: 192,
name: "早川 友香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 42,
construction: 29,
management: 44,
salary: 25,
specialNames: []
},

{
id: 193,
name: "青木 次郎",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 40,
construction: 33,
management: 31,
salary: 29,
specialNames: []
},

{
id: 194,
name: "関口 颯太",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 26,
construction: 41,
management: 37,
salary: 28,
specialNames: [
"浪費家",
]
},

{
id: 195,
name: "近藤 直樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 38,
construction: 41,
management: 27,
salary: 25,
specialNames: []
},

{
id: 196,
name: "遠藤 葵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 36,
construction: 41,
management: 30,
salary: 24,
specialNames: []
},

{
id: 197,
name: "中村 悟",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 32,
construction: 45,
management: 39,
salary: 29,
specialNames: [
"押しが弱い",
]
},

{
id: 198,
name: "酒井 乃愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 28,
construction: 39,
management: 30,
salary: 16,
specialNames: [
"数字が苦手",
]
},

{
id: 199,
name: "酒井 誠",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 25,
construction: 42,
management: 38,
salary: 20,
specialNames: [
"遅刻癖",
]
},

{
id: 200,
name: "清水 葵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 25,
construction: 40,
management: 32,
salary: 21,
specialNames: [
"抱え込み",
]
},

{
id: 201,
name: "杉浦 陽翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 30,
construction: 29,
management: 40,
salary: 21,
specialNames: [
"見栄っ張り",
]
},

{
id: 202,
name: "藤井 学",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 25,
construction: 43,
management: 30,
salary: 15,
specialNames: [
"押しが弱い",
]
},

{
id: 203,
name: "平野 朋美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 26,
construction: 31,
management: 45,
salary: 22,
specialNames: [
"詰めが甘い",
]
},

{
id: 204,
name: "清水 愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 36,
construction: 41,
management: 45,
salary: 30,
specialNames: []
},

{
id: 205,
name: "柴田 凛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 28,
construction: 29,
management: 30,
salary: 16,
specialNames: [
"現場嫌い",
]
},

{
id: 206,
name: "丸山 奈々",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 45,
construction: 28,
management: 30,
salary: 29,
specialNames: []
},

{
id: 207,
name: "横山 花子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 35,
construction: 29,
management: 32,
salary: 27,
specialNames: [
"報連相不足",
]
},

{
id: 208,
name: "ジョンソン リナ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 33,
construction: 28,
management: 36,
salary: 15,
specialNames: [
"書類ミス",
]
},

{
id: 209,
name: "十文字 晴翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 36,
construction: 32,
management: 25,
salary: 18,
specialNames: [
"抱え込み",
]
},

{
id: 210,
name: "服部 亜美",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 26,
construction: 27,
management: 45,
salary: 22,
specialNames: []
},

{
id: 211,
name: "岡本 由佳",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 26,
construction: 30,
management: 39,
salary: 17,
specialNames: []
},

{
id: 212,
name: "宮崎 綾乃",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 37,
construction: 45,
management: 45,
salary: 19,
specialNames: []
},

{
id: 213,
name: "西田 三郎",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 42,
construction: 30,
management: 34,
salary: 20,
specialNames: [
"詰めが甘い",
]
},

{
id: 214,
name: "島田 愛",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 32,
construction: 40,
management: 26,
salary: 26,
specialNames: [
"交渉下手",
]
},

{
id: 215,
name: "稲垣 典子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 32,
construction: 31,
management: 45,
salary: 19,
specialNames: []
},

{
id: 216,
name: "島田 湊",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 40,
construction: 37,
management: 41,
salary: 28,
specialNames: [
"短気",
]
},

{
id: 217,
name: "久保 静香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 35,
construction: 30,
management: 43,
salary: 28,
specialNames: [
"朝が弱い",
]
},

{
id: 218,
name: "山田 悠斗",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 45,
construction: 31,
management: 29,
salary: 27,
specialNames: [
"詰めが甘い",
]
},

{
id: 219,
name: "大谷 悟",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 36,
construction: 43,
management: 37,
salary: 29,
specialNames: []
},

{
id: 220,
name: "安田 忠司",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 32,
construction: 26,
management: 40,
salary: 27,
specialNames: [
"慎重すぎる",
]
},

{
id: 221,
name: "東 直人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 41,
construction: 39,
management: 36,
salary: 23,
specialNames: []
},

{
id: 222,
name: "水野 清隆",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 29,
construction: 41,
management: 28,
salary: 23,
specialNames: [
"数字が苦手",
]
},

{
id: 223,
name: "ワン ジュリアン",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 40,
construction: 28,
management: 29,
salary: 22,
specialNames: []
},

{
id: 224,
name: "上田 玲央",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 38,
construction: 25,
management: 30,
salary: 30,
specialNames: []
},

{
id: 225,
name: "山内 花子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 39,
construction: 33,
management: 34,
salary: 17,
specialNames: []
},

{
id: 226,
name: "宮田 智也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 39,
construction: 37,
management: 38,
salary: 29,
specialNames: []
},

{
id: 227,
name: "渡辺 竜也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 39,
construction: 29,
management: 35,
salary: 25,
specialNames: []
},

{
id: 228,
name: "大島 健二",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 41,
construction: 39,
management: 37,
salary: 24,
specialNames: []
},

{
id: 229,
name: "伊藤 英明",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 37,
construction: 30,
management: 31,
salary: 27,
specialNames: [
"遅刻癖",
]
},

{
id: 230,
name: "中島 詩織",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 42,
construction: 31,
management: 26,
salary: 25,
specialNames: []
},

{
id: 231,
name: "千葉 真希",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 42,
construction: 37,
management: 45,
salary: 28,
specialNames: [
"数字が苦手",
]
},

{
id: 232,
name: "市川 次郎",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 25,
construction: 32,
management: 30,
salary: 22,
specialNames: []
},

{
id: 233,
name: "村上 隆弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 43,
construction: 45,
management: 33,
salary: 19,
specialNames: [
"整理下手",
]
},

{
id: 234,
name: "酒井 太一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 37,
construction: 45,
management: 26,
salary: 26,
specialNames: [
"報連相不足",
]
},

{
id: 235,
name: "久保 大輔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 37,
construction: 38,
management: 33,
salary: 20,
specialNames: []
},

{
id: 236,
name: "阿部 仁",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 30,
construction: 44,
management: 44,
salary: 22,
specialNames: []
},

{
id: 237,
name: "飯田 義弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 25,
construction: 26,
management: 42,
salary: 29,
specialNames: []
},

{
id: 238,
name: "望月 亮",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 33,
construction: 44,
management: 34,
salary: 19,
specialNames: [
"交渉下手",
]
},

{
id: 239,
name: "小林 真司",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 37,
construction: 45,
management: 33,
salary: 20,
specialNames: []
},

{
id: 240,
name: "川崎 紬",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 34,
construction: 34,
management: 45,
salary: 17,
specialNames: []
},

{
id: 241,
name: "原 大和",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 33,
construction: 35,
management: 25,
salary: 16,
specialNames: []
},

{
id: 242,
name: "ワン オリバー",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 37,
construction: 27,
management: 43,
salary: 30,
specialNames: []
},

{
id: 243,
name: "杉山 修",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 36,
construction: 30,
management: 30,
salary: 24,
specialNames: [
"飽き性",
]
},

{
id: 244,
name: "原田 心春",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 32,
construction: 26,
management: 31,
salary: 23,
specialNames: [
"慎重すぎる",
]
},

{
id: 245,
name: "宮本 真由",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 40,
construction: 35,
management: 29,
salary: 16,
specialNames: [
"慎重すぎる",
]
},

{
id: 246,
name: "土屋 玲奈",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 44,
construction: 39,
management: 27,
salary: 21,
specialNames: []
},

{
id: 247,
name: "原田 千夏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 36,
construction: 25,
management: 40,
salary: 27,
specialNames: []
},

{
id: 248,
name: "北村 紀子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 32,
construction: 43,
management: 40,
salary: 18,
specialNames: []
},

{
id: 249,
name: "杉山 祐介",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 45,
construction: 42,
management: 29,
salary: 20,
specialNames: []
},

{
id: 250,
name: "トラン マルコ",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 45,
construction: 27,
management: 33,
salary: 25,
specialNames: [
"見栄っ張り",
]
},

{
id: 251,
name: "近藤 一樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 26,
sales: 44,
construction: 41,
management: 42,
salary: 19,
specialNames: [
"報連相不足",
]
},

{
id: 252,
name: "田村 英明",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 29,
construction: 45,
management: 41,
salary: 15,
specialNames: [
"押しが弱い",
]
},

{
id: 253,
name: "ガルシア ダニエル",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 38,
sales: 36,
construction: 39,
management: 40,
salary: 28,
specialNames: [
"抱え込み",
]
},

{
id: 254,
name: "松井 陽介",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 25,
sales: 38,
construction: 42,
management: 27,
salary: 15,
specialNames: []
},

{
id: 255,
name: "菅野 陽翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 33,
construction: 39,
management: 25,
salary: 28,
specialNames: []
},

{
id: 256,
name: "樋口 美琴",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 28,
construction: 27,
management: 27,
salary: 27,
specialNames: [
"現場嫌い",
]
},

{
id: 257,
name: "関口 一樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 31,
construction: 38,
management: 38,
salary: 17,
specialNames: [
"飽き性",
]
},

{
id: 258,
name: "三浦 杏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 32,
construction: 28,
management: 37,
salary: 27,
specialNames: [
"浪費家",
]
},

{
id: 259,
name: "川口 絵里",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 43,
construction: 28,
management: 37,
salary: 22,
specialNames: [
"気分屋",
]
},

{
id: 260,
name: "北村 文也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 38,
construction: 45,
management: 30,
salary: 23,
specialNames: []
},

{
id: 261,
name: "片岡 大和",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 44,
construction: 33,
management: 28,
salary: 18,
specialNames: []
},

{
id: 262,
name: "森 千尋",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 29,
construction: 38,
management: 37,
salary: 20,
specialNames: [
"気分屋",
]
},

{
id: 263,
name: "岡田 彩香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 41,
construction: 44,
management: 39,
salary: 24,
specialNames: []
},

{
id: 264,
name: "岡崎 紬",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 27,
construction: 31,
management: 42,
salary: 28,
specialNames: [
"数字が苦手",
]
},

{
id: 265,
name: "松本 心春",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 41,
sales: 39,
construction: 42,
management: 29,
salary: 26,
specialNames: [
"押しが弱い",
]
},

{
id: 266,
name: "渡辺 彩乃",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 28,
sales: 35,
construction: 36,
management: 30,
salary: 21,
specialNames: []
},

{
id: 267,
name: "大野 蓮",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 45,
construction: 34,
management: 32,
salary: 25,
specialNames: [
"抱え込み",
]
},

{
id: 268,
name: "川崎 典子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 35,
construction: 34,
management: 37,
salary: 20,
specialNames: [
"報連相不足",
]
},

{
id: 269,
name: "増田 清隆",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 33,
construction: 31,
management: 29,
salary: 27,
specialNames: [
"気分屋",
]
},

{
id: 270,
name: "島田 一樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 26,
construction: 40,
management: 29,
salary: 28,
specialNames: [
"数字が苦手",
]
},

{
id: 271,
name: "杉本 静香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 43,
sales: 27,
construction: 35,
management: 36,
salary: 20,
specialNames: []
},

{
id: 272,
name: "ビアンキ エミリー",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 27,
construction: 28,
management: 45,
salary: 15,
specialNames: []
},

{
id: 273,
name: "吉川 遼",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 34,
sales: 34,
construction: 38,
management: 43,
salary: 28,
specialNames: []
},

{
id: 274,
name: "中山 智子",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 35,
sales: 28,
construction: 38,
management: 29,
salary: 21,
specialNames: []
},

{
id: 275,
name: "石井 遥",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 27,
construction: 42,
management: 42,
salary: 17,
specialNames: []
},

{
id: 276,
name: "田村 俊介",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 28,
construction: 43,
management: 26,
salary: 25,
specialNames: []
},

{
id: 277,
name: "菅野 悠真",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 44,
sales: 27,
construction: 44,
management: 37,
salary: 28,
specialNames: []
},

{
id: 278,
name: "辻 早苗",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 31,
construction: 36,
management: 34,
salary: 24,
specialNames: []
},

{
id: 279,
name: "池田 沙織",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 35,
construction: 29,
management: 38,
salary: 29,
specialNames: []
},

{
id: 280,
name: "ミラー オリバー",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 40,
sales: 40,
construction: 45,
management: 32,
salary: 24,
specialNames: [
"報連相不足",
]
},

{
id: 281,
name: "新井 太一",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 40,
construction: 45,
management: 32,
salary: 22,
specialNames: [
"押しが弱い",
]
},

{
id: 282,
name: "柴田 海斗",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 42,
construction: 35,
management: 38,
salary: 24,
specialNames: []
},

{
id: 283,
name: "十文字 朝陽",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 36,
sales: 44,
construction: 43,
management: 36,
salary: 25,
specialNames: []
},

{
id: 284,
name: "太田 春香",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 27,
construction: 31,
management: 45,
salary: 20,
specialNames: []
},

{
id: 285,
name: "森田 葵",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 37,
sales: 33,
construction: 25,
management: 29,
salary: 30,
specialNames: [
"押しが弱い",
]
},

{
id: 286,
name: "坂口 克己",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 42,
sales: 25,
construction: 31,
management: 31,
salary: 27,
specialNames: []
},

{
id: 287,
name: "千葉 真司",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 31,
construction: 31,
management: 41,
salary: 23,
specialNames: []
},

{
id: 288,
name: "岡田 陽翔",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 38,
construction: 45,
management: 26,
salary: 21,
specialNames: []
},

{
id: 289,
name: "後藤 絵里",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 30,
sales: 25,
construction: 41,
management: 33,
salary: 19,
specialNames: [
"設備音痴",
]
},

{
id: 290,
name: "山崎 英明",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 33,
construction: 45,
management: 31,
salary: 28,
specialNames: []
},

{
id: 291,
name: "水野 隆弘",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 39,
construction: 41,
management: 30,
salary: 17,
specialNames: []
},

{
id: 292,
name: "永田 千夏",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 30,
construction: 42,
management: 32,
salary: 30,
specialNames: []
},

{
id: 293,
name: "川村 達也",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 32,
sales: 40,
construction: 32,
management: 35,
salary: 17,
specialNames: []
},

{
id: 294,
name: "ミュラー エマ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 31,
sales: 42,
construction: 25,
management: 42,
salary: 29,
specialNames: []
},

{
id: 295,
name: "村田 直樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 39,
sales: 27,
construction: 33,
management: 42,
salary: 17,
specialNames: []
},

{
id: 296,
name: "滝沢 千尋",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 44,
construction: 36,
management: 45,
salary: 21,
specialNames: []
},

{
id: 297,
name: "ロペス カミラ",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 45,
sales: 29,
construction: 29,
management: 32,
salary: 30,
specialNames: [
"気分屋",
]
},

{
id: 298,
name: "太田 正人",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 27,
sales: 26,
construction: 45,
management: 32,
salary: 26,
specialNames: []
},

{
id: 299,
name: "吉田 直樹",
gender: "male",
rarity: "N",
level: 1,
exp: 0,
leadership: 33,
sales: 29,
construction: 43,
management: 42,
salary: 21,
specialNames: []
},

{
id: 300,
name: "吉田 結衣",
gender: "female",
rarity: "N",
level: 1,
exp: 0,
leadership: 29,
sales: 44,
construction: 31,
management: 28,
salary: 15,
specialNames: [
"整理下手",
]
},

{
id: 301,
name: "林 陽子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 47,
sales: 54,
construction: 45,
management: 50,
salary: 28,
specialNames: [
"カリスマ",
"弱気",
]
},

{
id: 302,
name: "高木 清隆",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 46,
sales: 42,
construction: 47,
management: 52,
salary: 23,
specialNames: [
"数字に強い",
]
},

{
id: 303,
name: "中川 和也",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 40,
construction: 47,
management: 48,
salary: 27,
specialNames: [
"法務感覚",
"抱え込み",
]
},

{
id: 304,
name: "佐藤 大地",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 55,
sales: 49,
construction: 60,
management: 53,
salary: 33,
specialNames: [
"成長株",
"整理下手",
]
},

{
id: 305,
name: "渡辺 紬",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 48,
sales: 49,
construction: 53,
management: 48,
salary: 31,
specialNames: [
"原価管理",
]
},

{
id: 306,
name: "村田 優斗",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 50,
construction: 60,
management: 54,
salary: 27,
specialNames: [
"入居者目線",
]
},

{
id: 307,
name: "高島 啓太",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 40,
construction: 59,
management: 53,
salary: 30,
specialNames: [
"数字に強い",
"整理下手",
]
},

{
id: 308,
name: "小野 慎一",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 40,
construction: 55,
management: 55,
salary: 32,
specialNames: [
"法務感覚",
"慎重すぎる",
]
},

{
id: 309,
name: "竹田 梨花",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 51,
construction: 42,
management: 59,
salary: 23,
specialNames: [
"クレーム処理",
]
},

{
id: 310,
name: "十文字 匠",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 42,
sales: 46,
construction: 53,
management: 44,
salary: 28,
specialNames: [
"鉄壁管理",
"整理下手",
]
},

{
id: 311,
name: "高橋 夏帆",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 60,
construction: 43,
management: 56,
salary: 31,
specialNames: [
"数字に強い",
]
},

{
id: 312,
name: "阿部 海斗",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 47,
sales: 58,
construction: 49,
management: 44,
salary: 35,
specialNames: [
"調整役",
"慎重すぎる",
]
},

{
id: 313,
name: "沢田 太郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 40,
sales: 42,
construction: 60,
management: 52,
salary: 30,
specialNames: [
"カリスマ",
]
},

{
id: 314,
name: "佐野 沙織",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 53,
construction: 40,
management: 54,
salary: 30,
specialNames: [
"粘り腰",
]
},

{
id: 315,
name: "千葉 雄大",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 46,
sales: 50,
construction: 60,
management: 58,
salary: 35,
specialNames: [
"客付け名人",
]
},

{
id: 316,
name: "岩崎 翔",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 40,
construction: 49,
management: 46,
salary: 31,
specialNames: [
"チーム統率",
"詰めが甘い",
]
},

{
id: 317,
name: "マルティン オリビア",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 41,
sales: 42,
construction: 53,
management: 44,
salary: 30,
specialNames: [
"即断即決",
]
},

{
id: 318,
name: "山内 剛",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 42,
sales: 42,
construction: 48,
management: 56,
salary: 28,
specialNames: [
"資金繰り",
]
},

{
id: 319,
name: "ロッシ サラ",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 42,
construction: 40,
management: 60,
salary: 29,
specialNames: [
"努力家",
]
},

{
id: 320,
name: "今井 次郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 46,
sales: 40,
construction: 45,
management: 56,
salary: 30,
specialNames: [
"即断即決",
]
},

{
id: 321,
name: "村田 智子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 57,
construction: 59,
management: 60,
salary: 35,
specialNames: [
"一点突破",
]
},

{
id: 322,
name: "後藤 悟",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 49,
construction: 60,
management: 59,
salary: 29,
specialNames: [
"家賃査定士",
]
},

{
id: 323,
name: "今井 直樹",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 43,
sales: 45,
construction: 60,
management: 40,
salary: 26,
specialNames: [
"名工",
"慎重すぎる",
]
},

{
id: 324,
name: "松尾 文也",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 49,
sales: 53,
construction: 60,
management: 54,
salary: 28,
specialNames: [
"市場分析",
]
},

{
id: 325,
name: "福島 美咲",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 58,
construction: 53,
management: 56,
salary: 34,
specialNames: [
"資金繰り",
]
},

{
id: 326,
name: "高島 拓也",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 59,
construction: 49,
management: 45,
salary: 32,
specialNames: [
"カリスマ",
"慎重すぎる",
]
},

{
id: 327,
name: "樋口 和也",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 52,
construction: 47,
management: 52,
salary: 26,
specialNames: [
"数字に強い",
"慎重すぎる",
]
},

{
id: 328,
name: "河合 花子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 58,
sales: 54,
construction: 54,
management: 51,
salary: 34,
specialNames: [
"人脈豊富",
]
},

{
id: 329,
name: "酒井 優奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 58,
construction: 52,
management: 47,
salary: 24,
specialNames: [
"冷静沈着",
]
},

{
id: 330,
name: "神谷 祐奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 42,
construction: 55,
management: 52,
salary: 30,
specialNames: [
"即断即決",
"現場嫌い",
]
},

{
id: 331,
name: "若松 龍二",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 55,
sales: 40,
construction: 44,
management: 52,
salary: 31,
specialNames: [
"冷静沈着",
"数字が苦手",
]
},

{
id: 332,
name: "菊池 慎吾",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 48,
construction: 51,
management: 40,
salary: 31,
specialNames: [
"スピード対応",
"現場嫌い",
]
},

{
id: 333,
name: "川上 由美",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 40,
construction: 42,
management: 55,
salary: 27,
specialNames: [
"堅実運用",
"朝が弱い",
]
},

{
id: 334,
name: "森本 優斗",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 42,
sales: 51,
construction: 55,
management: 49,
salary: 21,
specialNames: [
"費用圧縮",
]
},

{
id: 335,
name: "ワン ユナ",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 40,
construction: 56,
management: 51,
salary: 30,
specialNames: [
"入居者目線",
"設備音痴",
]
},

{
id: 336,
name: "林 優奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 58,
construction: 55,
management: 43,
salary: 20,
specialNames: [
"名工",
]
},

{
id: 337,
name: "平野 奈々",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 47,
construction: 58,
management: 51,
salary: 31,
specialNames: [
"現場主義",
"空回り",
]
},

{
id: 338,
name: "本田 悠斗",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 47,
construction: 40,
management: 51,
salary: 32,
specialNames: [
"段取り上手",
]
},

{
id: 339,
name: "菅原 平蔵",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 55,
sales: 40,
construction: 60,
management: 45,
salary: 24,
specialNames: [
"物件再生",
"設備音痴",
]
},

{
id: 340,
name: "坂本 湊",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 41,
sales: 49,
construction: 58,
management: 40,
salary: 29,
specialNames: [
"管理の鬼",
"弱気",
]
},

{
id: 341,
name: "久保 雄大",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 55,
construction: 60,
management: 44,
salary: 30,
specialNames: [
"物件再生",
"報連相不足",
]
},

{
id: 342,
name: "岡本 美央",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 48,
sales: 48,
construction: 40,
management: 57,
salary: 34,
specialNames: [
"粘り腰",
"朝が弱い",
]
},

{
id: 343,
name: "藤井 真司",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 54,
construction: 56,
management: 48,
salary: 23,
specialNames: [
"成長株",
"押しが弱い",
]
},

{
id: 344,
name: "吉村 亮平",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 42,
sales: 49,
construction: 41,
management: 49,
salary: 32,
specialNames: [
"鉄壁管理",
]
},

{
id: 345,
name: "福島 隆弘",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 57,
construction: 54,
management: 45,
salary: 33,
specialNames: [
"人脈豊富",
"朝が弱い",
]
},

{
id: 346,
name: "松井 千尋",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 50,
construction: 53,
management: 49,
salary: 28,
specialNames: [
"金融感覚",
"慎重すぎる",
]
},

{
id: 347,
name: "増田 葵",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 43,
sales: 49,
construction: 57,
management: 51,
salary: 21,
specialNames: [
"軍師",
]
},

{
id: 348,
name: "村田 朱里",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 42,
construction: 58,
management: 57,
salary: 25,
specialNames: [
"軍師",
]
},

{
id: 349,
name: "村上 詩織",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 50,
construction: 44,
management: 58,
salary: 35,
specialNames: [
"客付け名人",
]
},

{
id: 350,
name: "高橋 優斗",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 45,
construction: 54,
management: 59,
salary: 28,
specialNames: [
"段取り上手",
]
},

{
id: 351,
name: "ビアンキ マリア",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 49,
sales: 52,
construction: 47,
management: 60,
salary: 29,
specialNames: [
"成長株",
]
},

{
id: 352,
name: "服部 詩織",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 55,
sales: 46,
construction: 56,
management: 57,
salary: 22,
specialNames: [
"段取り上手",
"気分屋",
]
},

{
id: 353,
name: "石川 平蔵",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 49,
sales: 54,
construction: 59,
management: 49,
salary: 22,
specialNames: [
"法務感覚",
"見栄っ張り",
]
},

{
id: 354,
name: "ワン ジュリア",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 46,
construction: 43,
management: 43,
salary: 32,
specialNames: [
"原価管理",
"短気",
]
},

{
id: 355,
name: "丹羽 龍二",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 45,
construction: 45,
management: 51,
salary: 33,
specialNames: [
"客付け名人",
]
},

{
id: 356,
name: "平井 颯太",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 43,
sales: 60,
construction: 60,
management: 48,
salary: 26,
specialNames: [
"家賃査定士",
"気分屋",
]
},

{
id: 357,
name: "古川 陽子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 46,
sales: 40,
construction: 57,
management: 60,
salary: 30,
specialNames: [
"カリスマ",
"遅刻癖",
]
},

{
id: 358,
name: "山田 樹",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 41,
sales: 52,
construction: 59,
management: 45,
salary: 32,
specialNames: [
"家主目線",
"空回り",
]
},

{
id: 359,
name: "大谷 帆波",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 49,
sales: 47,
construction: 54,
management: 52,
salary: 33,
specialNames: [
"クレーム処理",
]
},

{
id: 360,
name: "今井 美央",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 60,
construction: 47,
management: 60,
salary: 22,
specialNames: [
"クレーム処理",
]
},

{
id: 361,
name: "河野 美月",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 50,
sales: 51,
construction: 48,
management: 49,
salary: 20,
specialNames: [
"集中力",
"抱え込み",
]
},

{
id: 362,
name: "村瀬 康平",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 45,
construction: 57,
management: 46,
salary: 24,
specialNames: [
"原価管理",
"押しが弱い",
]
},

{
id: 363,
name: "原 香織",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 47,
sales: 55,
construction: 54,
management: 50,
salary: 20,
specialNames: [
"火消し役",
]
},

{
id: 364,
name: "内田 竜也",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 40,
sales: 48,
construction: 60,
management: 42,
salary: 26,
specialNames: [
"カリスマ",
"見栄っ張り",
]
},

{
id: 365,
name: "工藤 千尋",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 44,
sales: 51,
construction: 58,
management: 48,
salary: 31,
specialNames: [
"情報通",
"朝が弱い",
]
},

{
id: 366,
name: "北村 帆波",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 41,
construction: 43,
management: 53,
salary: 23,
specialNames: [
"改善提案",
"書類ミス",
]
},

{
id: 367,
name: "シュミット レオン",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 57,
construction: 47,
management: 47,
salary: 21,
specialNames: [
"法務感覚",
"報連相不足",
]
},

{
id: 368,
name: "宮崎 美咲",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 54,
construction: 51,
management: 53,
salary: 32,
specialNames: [
"職人気質",
"空回り",
]
},

{
id: 369,
name: "田中 直人",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 49,
construction: 49,
management: 48,
salary: 23,
specialNames: [
"費用圧縮",
"整理下手",
]
},

{
id: 370,
name: "川口 沙織",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 58,
construction: 46,
management: 59,
salary: 33,
specialNames: [
"粘り腰",
]
},

{
id: 371,
name: "中西 葵",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 44,
sales: 60,
construction: 50,
management: 55,
salary: 35,
specialNames: [
"現場監督",
]
},

{
id: 372,
name: "菅野 玲央",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 60,
construction: 42,
management: 57,
salary: 31,
specialNames: [
"入居者目線",
"設備音痴",
]
},

{
id: 373,
name: "林 三郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 45,
sales: 60,
construction: 44,
management: 54,
salary: 21,
specialNames: [
"資金繰り",
]
},

{
id: 374,
name: "西村 三郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 49,
construction: 45,
management: 53,
salary: 30,
specialNames: [
"慎重派",
]
},

{
id: 375,
name: "矢口 拓海",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 56,
construction: 57,
management: 54,
salary: 26,
specialNames: [
"現場監督",
]
},

{
id: 376,
name: "中島 次郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 56,
construction: 60,
management: 47,
salary: 28,
specialNames: [
"図面読み",
]
},

{
id: 377,
name: "山内 実咲",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 51,
construction: 51,
management: 59,
salary: 23,
specialNames: [
"即断即決",
]
},

{
id: 378,
name: "ブラウン ジュリア",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 48,
sales: 54,
construction: 42,
management: 54,
salary: 24,
specialNames: [
"市場分析",
"押しが弱い",
]
},

{
id: 379,
name: "中山 祐奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 40,
sales: 58,
construction: 54,
management: 50,
salary: 20,
specialNames: [
"調整役",
"押しが弱い",
]
},

{
id: 380,
name: "近藤 亮介",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 50,
sales: 47,
construction: 53,
management: 40,
salary: 27,
specialNames: [
"家賃査定士",
]
},

{
id: 381,
name: "チェン エマ",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 42,
sales: 47,
construction: 59,
management: 50,
salary: 32,
specialNames: [
"家賃査定士",
"設備音痴",
]
},

{
id: 382,
name: "グエン エリック",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 49,
construction: 48,
management: 56,
salary: 20,
specialNames: [
"現場監督",
]
},

{
id: 383,
name: "宮崎 紀子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 50,
construction: 46,
management: 60,
salary: 25,
specialNames: [
"即断即決",
"空回り",
]
},

{
id: 384,
name: "大橋 陸",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 48,
sales: 48,
construction: 47,
management: 50,
salary: 31,
specialNames: [
"堅実運用",
]
},

{
id: 385,
name: "関口 典子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 44,
construction: 52,
management: 60,
salary: 20,
specialNames: [
"DIY達人",
"浪費家",
]
},

{
id: 386,
name: "石田 彩香",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 51,
sales: 59,
construction: 40,
management: 49,
salary: 26,
specialNames: [
"火消し役",
"遅刻癖",
]
},

{
id: 387,
name: "滝沢 平蔵",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 43,
sales: 49,
construction: 57,
management: 57,
salary: 22,
specialNames: [
"空室キラー",
]
},

{
id: 388,
name: "菊池 一樹",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 60,
construction: 45,
management: 40,
salary: 23,
specialNames: [
"段取り上手",
]
},

{
id: 389,
name: "佐野 美央",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 55,
construction: 54,
management: 51,
salary: 35,
specialNames: [
"原価管理",
"現場嫌い",
]
},

{
id: 390,
name: "上田 平蔵",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 46,
sales: 55,
construction: 60,
management: 41,
salary: 29,
specialNames: [
"粘り腰",
"交渉下手",
]
},

{
id: 391,
name: "桜井 里奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 43,
sales: 47,
construction: 50,
management: 60,
salary: 32,
specialNames: [
"冷静沈着",
"短気",
]
},

{
id: 392,
name: "高野 隆弘",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 51,
construction: 60,
management: 56,
salary: 23,
specialNames: [
"金融感覚",
"飽き性",
]
},

{
id: 393,
name: "松本 裕子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 46,
construction: 59,
management: 56,
salary: 28,
specialNames: [
"交渉人",
"現場嫌い",
]
},

{
id: 394,
name: "チェン アンナ",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 52,
construction: 54,
management: 49,
salary: 35,
specialNames: [
"段取り上手",
]
},

{
id: 395,
name: "西村 亮平",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 44,
sales: 59,
construction: 53,
management: 51,
salary: 27,
specialNames: [
"先読み",
]
},

{
id: 396,
name: "武田 三郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 47,
sales: 56,
construction: 60,
management: 49,
salary: 21,
specialNames: [
"若手育成",
]
},

{
id: 397,
name: "山崎 恵",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 48,
construction: 43,
management: 60,
salary: 35,
specialNames: [
"修繕眼",
"数字が苦手",
]
},

{
id: 398,
name: "野村 紬",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 58,
construction: 44,
management: 54,
salary: 24,
specialNames: [
"空室キラー",
]
},

{
id: 399,
name: "渡部 透",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 54,
sales: 52,
construction: 43,
management: 41,
salary: 35,
specialNames: [
"軍師",
"遅刻癖",
]
},

{
id: 400,
name: "斎藤 英明",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 56,
sales: 52,
construction: 44,
management: 54,
salary: 35,
specialNames: [
"改善提案",
]
},

{
id: 401,
name: "野口 隆弘",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 53,
sales: 55,
construction: 51,
management: 56,
salary: 34,
specialNames: [
"即断即決",
]
},

{
id: 402,
name: "神谷 雅人",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 60,
sales: 56,
construction: 60,
management: 40,
salary: 27,
specialNames: [
"火消し役",
"整理下手",
]
},

{
id: 403,
name: "加藤 さくら",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 44,
sales: 43,
construction: 52,
management: 54,
salary: 25,
specialNames: [
"交渉人",
]
},

{
id: 404,
name: "榊原 拓海",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 45,
sales: 57,
construction: 50,
management: 58,
salary: 25,
specialNames: [
"市場分析",
"詰めが甘い",
]
},

{
id: 405,
name: "坂本 優奈",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 59,
sales: 55,
construction: 56,
management: 60,
salary: 34,
specialNames: [
"スピード対応",
"弱気",
]
},

{
id: 406,
name: "石川 紬",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 47,
sales: 60,
construction: 57,
management: 46,
salary: 22,
specialNames: [
"調整役",
"詰めが甘い",
]
},

{
id: 407,
name: "藤本 次郎",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 52,
sales: 55,
construction: 56,
management: 55,
salary: 29,
specialNames: [
"物件再生",
"設備音痴",
]
},

{
id: 408,
name: "片岡 英明",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 49,
sales: 58,
construction: 53,
management: 59,
salary: 30,
specialNames: [
"粘り腰",
"設備音痴",
]
},

{
id: 409,
name: "小川 美奈子",
gender: "female",
rarity: "R",
level: 1,
exp: 0,
leadership: 57,
sales: 48,
construction: 41,
management: 45,
salary: 30,
specialNames: [
"家賃査定士",
"抱え込み",
]
},

{
id: 410,
name: "中山 悠人",
gender: "male",
rarity: "R",
level: 1,
exp: 0,
leadership: 44,
sales: 56,
construction: 60,
management: 45,
salary: 21,
specialNames: [
"調整役",
]
},

{
id: 411,
name: "横山 葵",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 63,
sales: 71,
construction: 66,
management: 69,
salary: 66,
specialNames: [
"鉄壁管理",
"物件再生",
]
},

{
id: 412,
name: "川口 芽衣",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 56,
sales: 68,
construction: 68,
management: 75,
salary: 47,
specialNames: [
"堅実運用",
]
},

{
id: 413,
name: "野村 智子",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 70,
sales: 59,
construction: 66,
management: 58,
salary: 58,
specialNames: [
"修繕眼",
"段取り上手",
]
},

{
id: 414,
name: "鈴木 忠司",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 70,
sales: 63,
construction: 75,
management: 59,
salary: 67,
specialNames: [
"調整役",
]
},

{
id: 415,
name: "藤井 拓海",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 69,
sales: 75,
construction: 58,
management: 69,
salary: 66,
specialNames: [
"スピード対応",
]
},

{
id: 416,
name: "樋口 拓海",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 67,
construction: 75,
management: 61,
salary: 69,
specialNames: [
"交渉人",
]
},

{
id: 417,
name: "中野 直美",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 66,
sales: 55,
construction: 72,
management: 70,
salary: 68,
specialNames: [
"原価管理",
]
},

{
id: 418,
name: "竹内 樹",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 68,
sales: 67,
construction: 59,
management: 71,
salary: 49,
specialNames: [
"若手育成",
"入居者目線",
]
},

{
id: 419,
name: "神谷 亜美",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 68,
sales: 66,
construction: 66,
management: 69,
salary: 66,
specialNames: [
"資金繰り",
"努力家",
]
},

{
id: 420,
name: "小野 翔",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 59,
sales: 66,
construction: 70,
management: 56,
salary: 51,
specialNames: [
"職人気質",
]
},

{
id: 421,
name: "高島 健一",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 60,
sales: 68,
construction: 75,
management: 62,
salary: 47,
specialNames: [
"費用圧縮",
]
},

{
id: 422,
name: "長谷川 美月",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 56,
sales: 61,
construction: 69,
management: 61,
salary: 69,
specialNames: [
"管理の鬼",
"広告上手",
]
},

{
id: 423,
name: "大西 忠司",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 70,
sales: 65,
construction: 69,
management: 57,
salary: 56,
specialNames: [
"カリスマ",
]
},

{
id: 424,
name: "丸山 翔太",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 61,
sales: 65,
construction: 58,
management: 60,
salary: 56,
specialNames: [
"職人気質",
"家主目線",
]
},

{
id: 425,
name: "久保田 啓太",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 70,
sales: 67,
construction: 71,
management: 64,
salary: 61,
specialNames: [
"段取り上手",
]
},

{
id: 426,
name: "堀 智久",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 65,
sales: 62,
construction: 67,
management: 63,
salary: 65,
specialNames: [
"家賃査定士",
]
},

{
id: 427,
name: "安田 真司",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 65,
sales: 63,
construction: 65,
management: 57,
salary: 56,
specialNames: [
"火消し役",
]
},

{
id: 428,
name: "滝沢 拓海",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 67,
sales: 59,
construction: 75,
management: 55,
salary: 67,
specialNames: [
"火消し役",
"費用圧縮",
]
},

{
id: 429,
name: "神谷 由美",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 68,
sales: 75,
construction: 67,
management: 74,
salary: 45,
specialNames: [
"一点突破",
]
},

{
id: 430,
name: "柴田 直樹",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 60,
sales: 56,
construction: 60,
management: 61,
salary: 64,
specialNames: [
"火消し役",
"調整役",
]
},

{
id: 431,
name: "内藤 真司",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 74,
sales: 66,
construction: 57,
management: 55,
salary: 66,
specialNames: [
"聞き上手",
"交渉人",
]
},

{
id: 432,
name: "宮本 優奈",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 55,
sales: 71,
construction: 56,
management: 57,
salary: 49,
specialNames: [
"スピード対応",
]
},

{
id: 433,
name: "久保 友香",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 65,
sales: 56,
construction: 75,
management: 65,
salary: 58,
specialNames: [
"一点突破",
]
},

{
id: 434,
name: "丹羽 圭介",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 68,
sales: 60,
construction: 70,
management: 59,
salary: 69,
specialNames: [
"金融感覚",
"チーム統率",
]
},

{
id: 435,
name: "斎藤 陽翔",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 71,
sales: 73,
construction: 67,
management: 65,
salary: 69,
specialNames: [
"情報通",
"満室請負人",
]
},

{
id: 436,
name: "久保 紀子",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 58,
sales: 67,
construction: 64,
management: 66,
salary: 55,
specialNames: [
"図面読み",
"法務感覚",
]
},

{
id: 437,
name: "渡辺 悠真",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 57,
construction: 75,
management: 57,
salary: 65,
specialNames: [
"軍師",
"客付け名人",
]
},

{
id: 438,
name: "藤原 里奈",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 67,
sales: 65,
construction: 72,
management: 60,
salary: 68,
specialNames: [
"原価管理",
]
},

{
id: 439,
name: "川上 朝陽",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 58,
sales: 69,
construction: 68,
management: 71,
salary: 52,
specialNames: [
"入居者目線",
]
},

{
id: 440,
name: "村上 恵",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 59,
sales: 66,
construction: 61,
management: 55,
salary: 47,
specialNames: [
"先読み",
]
},

{
id: 441,
name: "丹羽 文也",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 74,
sales: 57,
construction: 75,
management: 60,
salary: 70,
specialNames: [
"満室請負人",
]
},

{
id: 442,
name: "スミス ミア",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 61,
sales: 71,
construction: 68,
management: 70,
salary: 63,
specialNames: [
"物件再生",
]
},

{
id: 443,
name: "高木 静香",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 63,
sales: 62,
construction: 60,
management: 68,
salary: 64,
specialNames: [
"空室キラー",
"現場主義",
]
},

{
id: 444,
name: "菅野 龍二",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 70,
sales: 73,
construction: 68,
management: 58,
salary: 48,
specialNames: [
"慎重派",
"物件再生",
]
},

{
id: 445,
name: "新井 清隆",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 69,
construction: 58,
management: 59,
salary: 48,
specialNames: [
"情報通",
"段取り上手",
]
},

{
id: 446,
name: "藤田 典子",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 55,
sales: 63,
construction: 65,
management: 69,
salary: 50,
specialNames: [
"カリスマ",
]
},

{
id: 447,
name: "丸山 蒼空",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 66,
construction: 64,
management: 67,
salary: 69,
specialNames: [
"火消し役",
]
},

{
id: 448,
name: "グエン ソフィア",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 69,
sales: 68,
construction: 72,
management: 65,
salary: 64,
specialNames: [
"費用圧縮",
]
},

{
id: 449,
name: "奥村 実咲",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 68,
sales: 69,
construction: 62,
management: 71,
salary: 62,
specialNames: [
"慎重派",
"冷静沈着",
]
},

{
id: 450,
name: "西村 美琴",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 73,
sales: 56,
construction: 65,
management: 66,
salary: 54,
specialNames: [
"金融感覚",
"広告上手",
]
},

{
id: 451,
name: "久保 健吾",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 62,
construction: 61,
management: 64,
salary: 53,
specialNames: [
"慎重派",
]
},

{
id: 452,
name: "木下 彩香",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 69,
sales: 58,
construction: 55,
management: 75,
salary: 67,
specialNames: [
"修繕眼",
"粘り腰",
]
},

{
id: 453,
name: "池田 さくら",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 72,
sales: 55,
construction: 74,
management: 75,
salary: 69,
specialNames: [
"火消し役",
"家賃査定士",
]
},

{
id: 454,
name: "太田 香織",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 60,
sales: 67,
construction: 55,
management: 68,
salary: 59,
specialNames: [
"クレーム処理",
]
},

{
id: 455,
name: "高田 奈々",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 61,
sales: 66,
construction: 59,
management: 65,
salary: 47,
specialNames: [
"調整役",
"法人営業",
]
},

{
id: 456,
name: "安田 源",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 63,
sales: 66,
construction: 65,
management: 66,
salary: 63,
specialNames: [
"家主目線",
]
},

{
id: 457,
name: "小松 朋美",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 61,
sales: 73,
construction: 72,
management: 73,
salary: 58,
specialNames: [
"火消し役",
]
},

{
id: 458,
name: "菊池 隆弘",
gender: "male",
rarity: "HR",
level: 1,
exp: 0,
leadership: 69,
sales: 69,
construction: 67,
management: 55,
salary: 58,
specialNames: [
"法務感覚",
"空室キラー",
]
},

{
id: 459,
name: "山本 朱里",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 69,
sales: 62,
construction: 65,
management: 74,
salary: 56,
specialNames: [
"成長株",
"家賃査定士",
]
},

{
id: 460,
name: "吉川 莉子",
gender: "female",
rarity: "HR",
level: 1,
exp: 0,
leadership: 66,
sales: 60,
construction: 63,
management: 75,
salary: 48,
specialNames: [
"入居者目線",
"慎重派",
]
},

{
id: 461,
name: "久保 香織",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 90,
sales: 86,
construction: 81,
management: 86,
salary: 164,
specialNames: [
"調整役",
"改善提案",
]
},

{
id: 462,
name: "菊池 光一",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 90,
sales: 83,
construction: 84,
management: 84,
salary: 130,
specialNames: [
"冷静沈着",
"努力家",
]
},

{
id: 463,
name: "北村 平蔵",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 76,
sales: 70,
construction: 81,
management: 75,
salary: 109,
specialNames: [
"物件再生",
"鉄壁管理",
]
},

{
id: 464,
name: "ウィリアムズ ハナ",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 82,
sales: 82,
construction: 76,
management: 87,
salary: 156,
specialNames: [
"家賃査定士",
"資金繰り",
]
},

{
id: 465,
name: "ミュラー エレナ",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 74,
sales: 89,
construction: 86,
management: 83,
salary: 185,
specialNames: [
"数字に強い",
"粘り腰",
]
},

{
id: 466,
name: "古川 亮",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 85,
sales: 71,
construction: 81,
management: 77,
salary: 134,
specialNames: [
"現場主義",
"情報通",
]
},

{
id: 467,
name: "増田 大地",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 70,
sales: 79,
construction: 90,
management: 86,
salary: 181,
specialNames: [
"堅実運用",
"満室請負人",
]
},

{
id: 468,
name: "中川 夏帆",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 89,
sales: 79,
construction: 88,
management: 88,
salary: 188,
specialNames: [
"法務感覚",
"金融感覚",
]
},

{
id: 469,
name: "杉山 竜也",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 90,
sales: 73,
construction: 74,
management: 85,
salary: 102,
specialNames: [
"努力家",
"家主目線",
]
},

{
id: 470,
name: "金子 湊",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 74,
sales: 82,
construction: 73,
management: 77,
salary: 173,
specialNames: [
"物件再生",
"冷静沈着",
]
},

{
id: 471,
name: "ミラー トーマス",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 90,
sales: 75,
construction: 74,
management: 79,
salary: 126,
specialNames: [
"DIY達人",
"市場分析",
]
},

{
id: 472,
name: "川村 龍二",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 84,
sales: 76,
construction: 76,
management: 72,
salary: 162,
specialNames: [
"法務感覚",
"粘り腰",
]
},

{
id: 473,
name: "関口 剛",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 72,
sales: 85,
construction: 86,
management: 70,
salary: 141,
specialNames: [
"粘り腰",
"堅実運用",
]
},

{
id: 474,
name: "岩田 康平",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 74,
sales: 82,
construction: 78,
management: 77,
salary: 108,
specialNames: [
"成長株",
"費用圧縮",
]
},

{
id: 475,
name: "ジョーンズ ローラ",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 85,
sales: 88,
construction: 80,
management: 86,
salary: 147,
specialNames: [
"数字に強い",
"クレーム処理",
]
},

{
id: 476,
name: "戸田 奈々",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 85,
sales: 89,
construction: 78,
management: 90,
salary: 187,
specialNames: [
"名工",
"数字に強い",
]
},

{
id: 477,
name: "樋口 悟",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 83,
sales: 74,
construction: 90,
management: 70,
salary: 128,
specialNames: [
"管理の鬼",
"空室キラー",
]
},

{
id: 478,
name: "中村 圭介",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 84,
sales: 82,
construction: 87,
management: 76,
salary: 125,
specialNames: [
"慎重派",
"修繕眼",
]
},

{
id: 479,
name: "横山 亮平",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 77,
sales: 77,
construction: 87,
management: 80,
salary: 132,
specialNames: [
"交渉人",
"改善提案",
]
},

{
id: 480,
name: "藤原 さくら",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 85,
sales: 85,
construction: 86,
management: 78,
salary: 168,
specialNames: [
"名工",
"冷静沈着",
]
},

{
id: 481,
name: "橋本 次郎",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 90,
sales: 74,
construction: 90,
management: 70,
salary: 133,
specialNames: [
"努力家",
"火消し役",
]
},

{
id: 482,
name: "ロッシ マルコ",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 83,
sales: 82,
construction: 78,
management: 85,
salary: 103,
specialNames: [
"軍師",
"現場主義",
]
},

{
id: 483,
name: "高田 源",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 81,
sales: 79,
construction: 90,
management: 76,
salary: 160,
specialNames: [
"調整役",
"法人営業",
]
},

{
id: 484,
name: "松岡 清隆",
gender: "male",
rarity: "SR",
level: 1,
exp: 0,
leadership: 76,
sales: 80,
construction: 70,
management: 89,
salary: 129,
specialNames: [
"入居者目線",
"情報通",
]
},

{
id: 485,
name: "樋口 朱里",
gender: "female",
rarity: "SR",
level: 1,
exp: 0,
leadership: 84,
sales: 73,
construction: 79,
management: 85,
salary: 123,
specialNames: [
"家主目線",
"集中力",
]
},

{
id: 486,
name: "藤原 隆弘",
gender: "male",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 86,
sales: 97,
construction: 100,
management: 96,
salary: 459,
specialNames: [
"数字に強い",
"市場分析",
"超能力者",
]
},

{
id: 487,
name: "新井 健吾",
gender: "male",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 99,
sales: 85,
construction: 95,
management: 88,
salary: 401,
specialNames: [
"家主目線",
"市場分析",
"超能力者",
]
},

{
id: 488,
name: "三浦 久美",
gender: "female",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 100,
sales: 94,
construction: 89,
management: 91,
salary: 493,
specialNames: [
"地域密着",
"法務感覚",
"絶対交渉権",
]
},

{
id: 489,
name: "菊池 由美",
gender: "female",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 85,
sales: 99,
construction: 93,
management: 93,
salary: 436,
specialNames: [
"原価管理",
"現場主義",
"満室神話",
]
},

{
id: 490,
name: "榊原 静香",
gender: "female",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 98,
sales: 85,
construction: 93,
management: 89,
salary: 406,
specialNames: [
"法務感覚",
"図面読み",
"王者の査定眼",
]
},

{
id: 491,
name: "河合 匠",
gender: "male",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 92,
sales: 100,
construction: 85,
management: 96,
salary: 466,
specialNames: [
"粘り腰",
"管理の鬼",
"超能力者",
]
},

{
id: 492,
name: "水野 匠",
gender: "male",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 98,
sales: 87,
construction: 90,
management: 87,
salary: 441,
specialNames: [
"カリスマ",
"スピード対応",
"超能力者",
]
},

{
id: 493,
name: "石井 英明",
gender: "male",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 98,
sales: 87,
construction: 98,
management: 90,
salary: 380,
specialNames: [
"市場分析",
"段取り上手",
"満室神話",
]
},

{
id: 494,
name: "竹田 希",
gender: "female",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 91,
sales: 94,
construction: 85,
management: 100,
salary: 383,
specialNames: [
"成長株",
"現場主義",
"黄金の人脈",
]
},

{
id: 495,
name: "金子 由佳",
gender: "female",
rarity: "SSR",
level: 1,
exp: 0,
leadership: 89,
sales: 98,
construction: 96,
management: 85,
salary: 377,
specialNames: [
"修繕眼",
"カリスマ",
"王者の査定眼",
]
},

{
id: 496,
name: "沢田 菫",
gender: "female",
rarity: "UR",
level: 1,
exp: 0,
leadership: 108,
sales: 96,
construction: 97,
management: 106,
salary: 670,
specialNames: [
"若手育成",
"軍師",
"満室請負人",
"都市開発の覇者",
]
},

{
id: 497,
name: "新井 紬",
gender: "female",
rarity: "UR",
level: 1,
exp: 0,
leadership: 109,
sales: 110,
construction: 107,
management: 105,
salary: 749,
specialNames: [
"市場分析",
"段取り上手",
"即断即決",
"利益の錬金術師",
]
},

{
id: 498,
name: "西田 慎一",
gender: "male",
rarity: "UR",
level: 1,
exp: 0,
leadership: 97,
sales: 99,
construction: 101,
management: 109,
salary: 747,
specialNames: [
"改善提案",
"家主目線",
"情報通",
"黄金の人脈",
]
},

{
id: 499,
name: "久保 蒼空",
gender: "male",
rarity: "UR",
level: 1,
exp: 0,
leadership: 110,
sales: 100,
construction: 102,
management: 95,
salary: 721,
specialNames: [
"鉄壁管理",
"現場監督",
"市場分析",
"再生の魔術師",
]
},

{
id: 500,
name: "佐野 伸一",
gender: "male",
rarity: "UR",
level: 1,
exp: 0,
leadership: 109,
sales: 95,
construction: 105,
management: 95,
salary: 749,
specialNames: [
"物件再生",
"慎重派",
"法務感覚",
"満室神話",
]
}
];

const MAX_EMPLOYEES_PER_OFFICE = 4;
const BRANCH_OFFICE_COST = 10000;
const BRANCH_OFFICE_BASE_MONTHS = 6;
const HQ_ACTION_RANGE = 10;
const BRANCH_ACTION_RANGE = 10;
const OFFICE_MIN_DISTANCE = 7;

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

const riverY = randomInt(6, MAP_SIZE - 10);

function isRoadCoordinate(x, y) {
  return verticalRoadXs.includes(x) || horizontalRoadYs.includes(y);
}

function isReservedFacilityCoordinate(x, y) {
  if (isSeaCoordinate(x, y)) return true;
  if (y === riverY) return true;
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
if (y === riverY) {
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

const rivalOfficeCandidates = tiles.filter((tile) => {
  if (tile.terrain !== TERRAIN.PLAIN) return false;
  if (tile.feature !== FEATURE.NONE) return false;
  if (tile.building) return false;
  if (tile.owner === OWNER.PUBLIC) return false;

  return isTileNearRoadOrRail(tile, tiles);
});

const fallbackRivalOfficeCandidates = tiles.filter((tile) => {
  if (tile.terrain !== TERRAIN.PLAIN) return false;
  if (tile.feature !== FEATURE.NONE) return false;
  if (tile.building) return false;
  if (tile.owner === OWNER.PUBLIC) return false;

  return true;
});

const rivalCandidatePool =
  rivalOfficeCandidates.length > 0 ? rivalOfficeCandidates : fallbackRivalOfficeCandidates;

const rivalOfficeTile =
  rivalCandidatePool.length > 0
    ? rivalCandidatePool[randomInt(0, rivalCandidatePool.length - 1)]
    : null;

if (rivalOfficeTile) {
  const rivalEmployee = pickRivalInitialEmployee();

  rivalOfficeTile.owner = OWNER.RIVAL;
  rivalOfficeTile.feature = FEATURE.HQ;
  rivalOfficeTile.building = null;
  rivalOfficeTile.rivalCompanyId = "A";
  rivalOfficeTile.rivalOfficeName = "東雲地所 本社";
  rivalOfficeTile.rivalEmployees = [rivalEmployee];
  rivalOfficeTile.rivalMoney = RIVAL_COMPANIES.A.initialMoney;
}

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
    document.title = "箱庭不動産経営シミュレーター V88";

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
const [usedSecretCommands, setUsedSecretCommands] = useState(savedGame?.usedSecretCommands ?? {});
const [showDeveloperCommand, setShowDeveloperCommand] = useState(false);
const [developerCommandInput, setDeveloperCommandInput] = useState("");
const [playerRankUpResult, setPlayerRankUpResult] = useState(null);
const [ticketRewardResult, setTicketRewardResult] = useState(null);
const [selectedCompanyDetail, setSelectedCompanyDetail] = useState(null);

const [employeeGachaResult, setEmployeeGachaResult] = useState(null);
const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState(null);
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
      money,
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

    localStorage.setItem(
      "realEstateGameSave",
      JSON.stringify(saveData)
    );
  }, 250);

  return () => {
    window.clearTimeout(saveTimer);
  };
}, [
  money,
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

  const employeePayroll = [...employees, ...employeeStorage].reduce((sum, employee) => {
    return sum + (employee.salary ?? 0);
  }, 0);

  return buildingMaintenance + employeePayroll;
}, [playerMainBuildings, employees, employeeStorage]);

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

const companyActionPower = useMemo(() => {
  if (!hqPlaced) return 0;

  return activeOfficeTiles.length;
}, [hqPlaced, activeOfficeTiles]);

const employeeSalaryTotal = useMemo(() => {
  return [...employees, ...employeeStorage].reduce((sum, employee) => {
    return sum + (employee.salary ?? 0);
  }, 0);
}, [employees, employeeStorage]);

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
  if (sortKey === "office") return getOfficeName(employee.officeId ?? null);
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
  const pickedIds = pickedEmployees.map((employee) => employee.id);

  for (let attempt = 0; attempt < 20; attempt++) {
    const rarity = premiumOnly ? drawPremiumRecruitRarity() : drawRecruitRarity();
    const sameRarityEmployees = availableEmployees.filter((employee) => {
      return employee.rarity === rarity && !pickedIds.includes(employee.id);
    });

    if (sameRarityEmployees.length > 0) {
      return sameRarityEmployees[randomInt(0, sameRarityEmployees.length - 1)];
    }
  }

  const fallbackEmployees = availableEmployees.filter((employee) => {
    if (pickedIds.includes(employee.id)) return false;
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
  recruitEmployeeByTicket("normal");
}

function recruitPremiumEmployees() {
  recruitEmployeeByTicket("premium");
}

function recruitEmployeeByTicket(ticketType) {
  if (!hqPlaced) {
    alert("先に本社を設置してください");
    return;
  }

  const isPremium = ticketType === "premium";

  if (!isPremium && employeeTickets < 1) {
    alert("社員チケットがありません。社員獲得には社員チケット1枚が必要です。");
    return;
  }

  if (isPremium && premiumEmployeeTickets < 1) {
    alert("社員プレミアムチケットがありません。SR以上確定ガチャにはプレミアムチケット1枚が必要です。");
    return;
  }

  const ownedIds = [
    ...employees.map((employee) => employee.id),
    ...employeeStorage.map((employee) => employee.id),
  ];

  const availableEmployees = EMPLOYEE_POOL.filter((employee) => {
    if (ownedIds.includes(employee.id)) return false;
    if (isPremium) return ["SR", "SSR", "UR"].includes(employee.rarity);
    return true;
  });

  if (availableEmployees.length === 0) {
    alert(isPremium ? "SR以上の獲得可能社員がもう残っていません" : "獲得できる社員がもう残っていません");
    return;
  }

  const acquiredEmployee = pickRecruitEmployee(availableEmployees, [], isPremium);

  if (!acquiredEmployee) {
    alert("社員の獲得に失敗しました");
    return;
  }

  const storedEmployee = normalizeEmployeeGrowthBase({
    ...acquiredEmployee,
    officeId: null,
  });

  if (isPremium) {
    setPremiumEmployeeTickets(premiumEmployeeTickets - 1);
  } else {
    setEmployeeTickets(employeeTickets - 1);
  }

  setEmployeeCandidates([]);
  setEmployeeStorage([
    ...employeeStorage,
    storedEmployee,
  ]);
  setEmployeeGachaResult({
    ...storedEmployee,
    ticketType: isPremium ? "premium" : "normal",
  });

  setLog(
    `${isPremium ? "社員プレミアムチケット" : "社員チケット"}1枚を使い、${acquiredEmployee.name}（${acquiredEmployee.rarity}）を獲得しました。社員保管庫に追加されました。`
  );
}

function addEmployeeTicketForDemo() {
  setEmployeeTickets(employeeTickets + 1);
  setLog("デモ用に社員チケットを1枚追加しました。");
}

function addPremiumEmployeeTicketForDemo() {
  setPremiumEmployeeTickets(premiumEmployeeTickets + 1);
  setLog("デモ用に社員プレミアムチケットを1枚追加しました。SR以上確定です。");
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

  if (employees.length < employeeLimit) {
    alert("現在の社員枠が満員でないと支店は開設できません");
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

  if (employees.length < employeeLimit) {
    alert("現在の社員枠が満員でないと支店は開設できません");
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
    alert(`支店は本社・他支店から${OFFICE_MIN_DISTANCE}マス以上離してください`);
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

  purchasePaymentTotal += finalPrice;

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

function runRivalCompanyMonthlyAction(tileList, companyId) {
  const company = getRivalCompany(companyId);
  let nextTiles = tileList;
  const companyTiles = nextTiles.filter((tile) => tile.owner === OWNER.RIVAL && tile.rivalCompanyId === companyId);
  const officeTilesForCompany = companyTiles.filter((tile) => tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH);

  if (officeTilesForCompany.length === 0) {
    return { tiles: nextTiles, logs: [] };
  }

  const logs = [];
  const hqTileForCompany = officeTilesForCompany.find((tile) => tile.feature === FEATURE.HQ) ?? officeTilesForCompany[0];
  let rivalMoney = hqTileForCompany?.rivalMoney ?? company.initialMoney ?? 10000;

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

  const nextRivalRank = hqTileForCompany?.rivalRank ?? Math.max(1, Math.floor(nextRivalAgeMonths / 12) + 1);

  nextTiles = updateRivalHq(nextTiles, {
    rivalAgeMonths: nextRivalAgeMonths,
    rivalEmployees,
    rivalSixMonthTicketGranted: nextRivalSixMonthTicketGranted,
    rivalRank: nextRivalRank,
  });

  const isInCompanyRange = (tile) => {
    return officeTilesForCompany.some((officeTile) => {
      const range = getOfficeActionRange(officeTile);
      return getDistance(tile.x, tile.y, officeTile.x, officeTile.y) <= range;
    });
  };

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
      return { tiles: nextTiles, logs };
    }

    const target = affordableCandidates[randomInt(0, affordableCandidates.length - 1)];
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

let rivalActionResult = runRivalCompanyMonthlyAction(cityChangedTiles, "A");
let rivalActionTiles = rivalActionResult.tiles;
eventLog.push(...rivalActionResult.logs);

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

const monthlyEmployeeSalary = [...employees, ...employeeStorage].reduce((sum, employee) => {
  return sum + (employee.salary ?? 0);
}, 0);

if (monthlyEmployeeSalary > 0) {
  maintenance += monthlyEmployeeSalary;
  eventLog.push(`社員給与 ${monthlyEmployeeSalary}万円を支払いました`);
}

const net = income - maintenance - taxPayment - purchasePaymentTotal;
const updatedAnnualStats = {
  income: (annualStats.income ?? 0) + income,
  maintenance: (annualStats.maintenance ?? 0) + maintenance,
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

let corporateTax = 0;
let finalNet = net;

if (gameDate.month === 3) {
  corporateTax = Math.max(0, Math.round((updatedAnnualStats.net ?? 0) * 0.3));
  finalNet -= corporateTax;
  if (corporateTax > 0) {
    eventLog.push(`法人税・事業税等 ${corporateTax}万円を支払いました`);
  }
}

    setMoney(money + finalNet);
    setMonth(month + 1);
    setActionPoints(companyActionPower);

const monthlyHistoryRecord = {
  label: gameDate.label,
  month,
  income,
  maintenance,
  tax: taxPayment,
  purchase: purchasePaymentTotal,
  corporateTax,
  net: finalNet,
  money: money + finalNet,
};
setMonthlyCompanyHistory((prev) => [monthlyHistoryRecord, ...prev].slice(0, 120));

if (gameDate.month === 3) {
  const report = {
    yearLabel: `${gameDate.year}年目`,
    ...updatedAnnualStats,
    corporateTax,
    netAfterTax: (updatedAnnualStats.net ?? 0) - corporateTax,
    money: money + finalNet,
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
  `${gameDate.label}終了：家賃${income}万円 / 維持費${maintenance}万円${taxText}${purchaseText} / 差引${net}万円\n` +
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
  setMonth(1);

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

  const newMap = createMap();

  setMoney(20000);
  setMonth(1);
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
  setPlayerRankUpResult(null);
  setTicketRewardResult(null);
  setSelectedCompanyDetail(null);
  setEmployeeGachaResult(null);
  setSelectedEmployeeDetail(null);

  setLog("全データをリセットしました。最初に本社を設置してください。");
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

const hasSaveData = Boolean(savedGame);
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
          <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.86 }}>Version 88</p>

          <div
            style={{
              margin: "0 auto 18px",
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.1)",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            {hasSaveData ? (
              <>
                <div><strong>最終プレイ</strong>：{getGameDate(savedGame?.month ?? month).label}</div>
                <div><strong>所持金</strong>：{money.toLocaleString()}万円</div>
                <div><strong>保有建物</strong>：{ownedBuildingCountForTitle}棟</div>
                <div><strong>総資産目安</strong>：{titleTotalAssets.toLocaleString()}万円</div>
              </>
            ) : (
              <div style={{ textAlign: "center" }}>セーブデータがありません</div>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" onClick={openGameFromTitle} style={{ padding: "13px 14px", borderRadius: 999, border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
              ▶ ゲームスタート
            </button>
            <button type="button" onClick={openGameFromTitle} disabled={!hasSaveData} style={{ padding: "12px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.35)", background: hasSaveData ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)", color: "#ffffff", fontWeight: 700, cursor: hasSaveData ? "pointer" : "not-allowed", opacity: hasSaveData ? 1 : 0.55 }}>
              ▶ 続きから
            </button>
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
    const isRivalLine = Object.values(RIVAL_COMPANIES).some((company) => {
      return line.startsWith(company.name);
    });

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
      <h2>{employeeGachaResult.ticketType === "premium" ? "プレミアム社員獲得！" : "社員獲得！"}</h2>
      <p className="employee-gacha-rarity">{getRarityLabel(employeeGachaResult.rarity)}</p>
      <h3>{employeeGachaResult.name}</h3>
      <p>
        統率 {employeeGachaResult.leadership ?? 0} / 営業 {employeeGachaResult.sales ?? 0} / 建築 {employeeGachaResult.construction ?? 0} / 管理 {employeeGachaResult.management ?? 0}
      </p>
      <p>月給 {renderEmployeeSalaryValue(employeeGachaResult)}</p>
      <p>特殊能力 {getEmployeeSpecialText(employeeGachaResult)}</p>
      <button onClick={() => setEmployeeGachaResult(null)}>OK</button>
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

{selectedEmployeeDetail && (
  <div className="popup-log">
    <div className="popup-log-card employee-detail-card">
      <h2>社員詳細</h2>
      <h3>{selectedEmployeeDetail.name}</h3>
      <p>レアリティ：{getRarityLabel(selectedEmployeeDetail.rarity)}</p>
      <p>所属：{selectedEmployeeDetail.officeId ? getOfficeName(selectedEmployeeDetail.officeId) : "社員保管庫"}</p>
      <p>Lv {selectedEmployeeDetail.level ?? 1} / EXP {selectedEmployeeDetail.exp ?? 0} / 次Lv必要 {getEmployeeRequiredExp(selectedEmployeeDetail.level ?? 1)} / 残り {Math.max(0, getEmployeeRequiredExp(selectedEmployeeDetail.level ?? 1) - (selectedEmployeeDetail.exp ?? 0))}</p>
      <table className="employee-detail-table">
        <tbody>
          <tr><th>統率</th><td>{renderEmployeeStatValue(selectedEmployeeDetail, "leadership", "baseLeadership")}</td></tr>
          <tr><th>営業</th><td>{renderEmployeeStatValue(selectedEmployeeDetail, "sales", "baseSales")}</td></tr>
          <tr><th>建築</th><td>{renderEmployeeStatValue(selectedEmployeeDetail, "construction", "baseConstruction")}</td></tr>
          <tr><th>管理</th><td>{renderEmployeeStatValue(selectedEmployeeDetail, "management", "baseManagement")}</td></tr>
          <tr><th>月給</th><td>{renderEmployeeSalaryValue(selectedEmployeeDetail)}</td></tr>
        </tbody>
      </table>
      <h3>特殊能力</h3>
      {(Array.isArray(selectedEmployeeDetail.specialNames) && selectedEmployeeDetail.specialNames.length > 0) ? (
        <div className="employee-skill-list">
          {selectedEmployeeDetail.specialNames.map((skillName) => (
            <div key={skillName} className="employee-skill-item">
              <strong>{skillName}</strong>
              <p>{getSpecialSkillDescription(skillName)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>特殊能力なし</p>
      )}
      <button onClick={() => setSelectedEmployeeDetail(null)}>閉じる</button>
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
          <h1 className="v73-title">箱庭不動産経営シミュレーター V88{isDemoMode ? "（デモ版）" : ""}</h1>
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
            <span>月家賃</span>
            <strong>{totalRent.toLocaleString()}万</strong>
            <span>維持費</span>
            <strong>{totalMaintenance.toLocaleString()}万</strong>
            <span>月利益</span>
            <strong>{monthlyProfit.toLocaleString()}万</strong>
            <span>空室率</span>
            <strong>{vacancyRate}%</strong>
          </div>
        </div>
      )}
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

      <main className={`main-layout ${(activePanel === "home" || activePanel === "hq" || activePanel === "land" || activePanel === "build" || activePanel === "employee" || activePanel === "property" || activePanel === "log" || activePanel === "option" || activePanel === "info") ? "full-panel" : ""}`}>
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
            )} / ${getFeatureName(tile.feature)} / ${getOwnerName(
              tile.owner
            )}${tile.owner === OWNER.RIVAL ? `（${getRivalCompany(tile.rivalCompanyId).name}）` : ""} / 地価:${tile.landPrice}万円${
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

        {(activePanel === "hq" || activePanel === "land" || activePanel === "build" || activePanel === "employee") && (
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
        <strong>操作パネル</strong>
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
    <h2>本社設置</h2>

    <p>最初に本社を設置してください。</p>

    {selectedTile ? (
      <div>
        <p>選択中土地 ({selectedTile.x}, {selectedTile.y})</p>
        <p>土地価格 {selectedTile.landPrice}万円</p>
        <p>所有 {getOwnerName(selectedTile.owner)}</p>
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
      一般本社RC造を設置
      {selectedTile
        ? `（合計 ${selectedTile.landPrice + 3000}万円）`
        : "（建設費3000万円）"}
    </button>

    <button onClick={() => placeHQ("apartment")}>
      アパート付きRC造本社を設置
      {selectedTile
        ? `（合計 ${selectedTile.landPrice + 8000}万円）`
        : "（建設費8000万円・4戸付き）"}
    </button>
  </div>
)}
{activePanel === "land" && (
  <div className="detail-card">
    <h2>土地・建物情報</h2>

    {!selectedTile && (
      <p>マップ上の土地を選択してください。</p>
    )}

    {selectedTile && (
      <>
        <p>座標 {selectedTile.x}, {selectedTile.y}</p>
        <p>地形 {getTerrainName(selectedTile.terrain)}</p>
        <p>施設 {getFeatureName(selectedTile.feature)}</p>
        <p>用途地域 {getZoneName(selectedTile.zone)}</p>
        <p>所有者 {getOwnerName(selectedTile.owner)}</p>
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
            <h3>{getRivalCompany(selectedTile.rivalCompanyId).name}</h3>
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
  年間固定資産税 {calculateYearlyPropertyTax(selectedMainTile)}万円
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

          {selectedTile.owner === OWNER.PLAYER &&
            isBuildableTile(selectedTile) &&
            !selectedTile.building &&
            selectedTile.feature !== FEATURE.HQ &&
            selectedTile.feature !== FEATURE.BRANCH && (
              <button
                onClick={startBranchPlacement}
                disabled={!isTileInOfficeRange(selectedTile)}
                title={!isTileInOfficeRange(selectedTile) ? "本社・支店の行動範囲外です" : ""}
              >
                {isTileInOfficeRange(selectedTile) ? "支店を開設する（1億円）" : "範囲外のため支店不可"}
              </button>
            )}

{selectedMainTile?.owner === OWNER.PLAYER &&
  selectedMainTile?.building && (
    <button onClick={demolish}>
      取り壊す
    </button>
)}

{selectedMainTile?.owner === OWNER.PLAYER &&
  selectedMainTile?.feature !== FEATURE.HQ && (
    <button onClick={sellProperty}>
      売却する
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

    <p>
      配属社員: {employeeCountText}人 / 保有社員: {ownedEmployeeCount}人 / 待機社員: {employeeStorage.length}人 / 月給合計: {employeeSalaryTotal}万円 / 社員チケット: {employeeTickets}枚 / プレミアム: {premiumEmployeeTickets}枚
    </p>

    <div className="button-row">
      <button
        disabled={employeeTickets < 1}
        onClick={recruitEmployees}
      >
        {employeeTickets < 1
          ? "社員チケット不足"
          : "社員チケットを使う"}
      </button>

      {isDemoMode && (
        <button onClick={addEmployeeTicketForDemo}>
          デモ用：社員チケット+1
        </button>
      )}

      <button
        disabled={premiumEmployeeTickets < 1}
        onClick={recruitPremiumEmployees}
      >
        {premiumEmployeeTickets < 1
          ? "プレミアムチケット不足"
          : "社員プレミアムチケットを使う（SR以上確定）"}
      </button>

      {isDemoMode && (
        <button onClick={addPremiumEmployeeTicketForDemo}>
          デモ用：社員プレミアムチケット+1
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

{activePanel === "build" && (
  <div className="detail-card build-pop-card">
    <h2>建設メニュー</h2>

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
        <p>支店を建てる土地を選択中です。行動範囲内で、本社・他支店から7マス以上離れた自分の空き土地をマップでクリックしてください。</p>
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
        onClick={() => setSelectedBuildCategory("商業")}
      >
        <span className="build-icon">🏪</span>
        <span>店舗</span>
      </button>
            <button
        className={`build-icon-button ${
          selectedBuildCategory === "工業" ? "active" : ""
        }`}
        onClick={() => setSelectedBuildCategory("工業")}
      >
        <span className="build-icon">🏭</span>
        <span>工業</span>
      </button>

      <button
        className={`build-icon-button ${
          selectedBuildCategory === "支店" ? "active" : ""
        }`}
        onClick={() => setSelectedBuildCategory("支店")}
      >
        <span className="build-icon">🏢</span>
        <span>支店</span>
      </button>

      <button
        className={`build-icon-button ${
          selectedBuildCategory === "修繕" ? "active" : ""
        }`}
        onClick={() => setSelectedBuildCategory("修繕")}
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
      <strong>{selectedBuildCategory}を選択中</strong>

      <button
        className="build-close-button"
        onClick={() => setSelectedBuildCategory(null)}
      >
        閉じる
      </button>
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
            <span>社員上限: +4人</span>
            <span>営業範囲: 10マス</span>
            <span>条件: 現在の社員枠が満員</span>
            <span>条件: 本社・他支店から7マス以上離す</span>
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
            

{activePanel === "info" && (
  <section className="property-section info-section">
    <h2>情報</h2>
    <div className="player-info-box v74-player-info-box">
      <h3>プレイヤー情報</h3>
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
            <th>区分</th>
            <th>会社名</th>
            <th>現金</th>
            <th>ランク</th>
            <th>月家賃</th>
            <th>月維持費</th>
            <th>月利益</th>
            <th>所有マス</th>
            <th>本社・支店</th>
            <th>建物数</th>
            <th>社員数</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><button onClick={() => setSelectedCompanyDetail("player")}>表示</button></td>
            <td>自社</td>
            <td>プレイヤー会社</td>
            <td>{money.toLocaleString()}万円</td>
            <td>{playerRank}</td>
            <td>{totalRent.toLocaleString()}万円</td>
            <td>{totalMaintenance.toLocaleString()}万円</td>
            <td>{monthlyProfit.toLocaleString()}万円</td>
            <td>{tiles.filter((tile) => tile.owner === OWNER.PLAYER).length}</td>
            <td>{officeTiles.length}</td>
            <td>{playerMainBuildings.filter((tile) => tile.building).length}</td>
            <td>{employees.length}人 / 保管{employeeStorage.length}人</td>
          </tr>
          {Object.values(RIVAL_COMPANIES).map((company) => {
            const companyTiles = tiles.filter((tile) => tile.owner === OWNER.RIVAL && tile.rivalCompanyId === company.id);
            if (companyTiles.length === 0) return null;
            const hqTile = companyTiles.find((tile) => tile.feature === FEATURE.HQ);
            const mainBuildings = companyTiles.filter((tile) => tile.building && !tile.buildingMainId);
            const rivalRent = mainBuildings.reduce((sum, tile) => {
              return sum + (tile.rooms ?? []).reduce((roomSum, room) => roomSum + (room.occupied ? room.rent ?? 0 : 0), 0);
            }, 0);
            const rivalMaintenance = mainBuildings.reduce((sum, tile) => sum + calculateMonthlyExpenses(tile), 0) + (hqTile?.rivalEmployees ?? []).reduce((sum, employee) => sum + (employee.salary ?? 0), 0);
            const rivalProfit = rivalRent - rivalMaintenance;
            const officeCount = companyTiles.filter((tile) => tile.feature === FEATURE.HQ || tile.feature === FEATURE.BRANCH).length;
            const employeeCount = (hqTile?.rivalEmployees ?? []).length;

            return (
              <tr key={company.id}>
                <td><button onClick={() => setSelectedCompanyDetail(company.id)}>表示</button></td>
                <td>ライバル</td>
                <td>{company.name}</td>
                <td>{(hqTile?.rivalMoney ?? company.initialMoney ?? 0).toLocaleString()}万円</td>
                <td>{hqTile?.rivalRank ?? 1}</td>
                <td>{rivalRent.toLocaleString()}万円</td>
                <td>{rivalMaintenance.toLocaleString()}万円</td>
                <td>{rivalProfit.toLocaleString()}万円</td>
                <td>{companyTiles.length}</td>
                <td>{officeCount}</td>
                <td>{mainBuildings.length}</td>
                <td>{employeeCount}人</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {selectedCompanyDetail && (
      <div className="company-detail-box">
        <h3>{selectedCompanyDetail === "player" ? "自社詳細" : `${getRivalCompany(selectedCompanyDetail).name} 詳細`}</h3>
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
          name: tile.hqName || "一般本社",
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