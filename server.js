import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const YEAR = 2026;
const TIMEZONE = "Europe/Istanbul";

const CACHE_TTL_MS = 10 * 60 * 1000;
const APPS_SCRIPT_TIMEOUT_MS = Math.max(
  60 * 1000,
  Number(
    process.env.APPS_SCRIPT_TIMEOUT_MS ||
    150 * 1000
  ) || 150 * 1000
);

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 500
  })
);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "change-this-secret",

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",

      secure:
        process.env.NODE_ENV ===
        "production",

      maxAge:
        8 * 60 * 60 * 1000
    }
  })
);

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLocaleLowerCase(
      "tr-TR"
    )
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

function normalizeHeader(value) {
  return normalizeText(
    value
  );
}

function makeLookup(row) {
  const out =
    Object.create(null);

  if (
    !row ||
    typeof row !== "object"
  ) {
    return out;
  }

  for (
    const [
      key,
      value
    ] of
    Object.entries(row)
  ) {
    out[
      normalizeHeader(key)
    ] = value;
  }

  return out;
}

function pick(
  lookup,
  ...aliases
) {
  for (
    const alias of
    aliases
  ) {
    const value =
      lookup[
        normalizeHeader(alias)
      ];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function pickStageTime(
  lookup,
  stage
) {
  const aliases =
    stage === "newlead"
      ? [
          "YD New Lead - Arrived Time",
          "YD New Lead - Arrive Time",
          "YD New Lead Arrived Time",
          "YD New Lead Arrive Time",
          "New Lead - Arrived Time",
          "New Lead - Arrive Time",
          "New Lead Arrived Time",
          "New Lead Arrive Time",
          "New Lead Arrival Time"
        ]
      : [
          "YD Quoted - Arrived Time",
          "YD Quoted - Arrive Time",
          "YD Quoted Arrived Time",
          "YD Quoted Arrive Time",
          "Quoted - Arrived Time",
          "Quoted - Arrive Time",
          "Quoted Arrived Time",
          "Quoted Arrive Time",
          "Quoted Arrival Time"
        ];

  const exact =
    pick(
      lookup,
      ...aliases
    );

  if (exact) {
    return exact;
  }

  /*
    Bitrix dışa aktarımında başlığa ek açıklama/UTC bilgisi eklenmişse
    tam başlık eşleşmesi yerine aşama + tarih/zaman parçalarını kullan.
  */
  const stageToken =
    stage === "newlead"
      ? "newlead"
      : "quoted";

  for (
    const [
      key,
      value
    ] of Object.entries(
      lookup
    )
  ) {
    const hasStage =
      key.includes(
        stageToken
      );

    const hasTime =
      key.includes("time") ||
      key.includes("date") ||
      key.includes("tarih");

    if (
      hasStage &&
      hasTime &&
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

function normalizeId(value) {
  const text =
    cleanText(value);

  return /^\d+\.0+$/.test(text)
    ? text.split(".")[0]
    : text;
}

function numberValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  let text =
    String(value)
      .trim()
      .replace(/\u00A0/g, "")
      .replace(/\s+/g, "")
      .replace(/[$€£₺]/g, "")
      .replace(
        /USD|EUR|GBP|TRY|TL/gi,
        ""
      )
      .replace(
        /[^0-9,.-]/g,
        ""
      );

  if (!text) {
    return 0;
  }

  const commaCount =
    (
      text.match(/,/g) ||
      []
    ).length;

  const dotCount =
    (
      text.match(/\./g) ||
      []
    ).length;

  const lastComma =
    text.lastIndexOf(",");

  const lastDot =
    text.lastIndexOf(".");

  if (
    commaCount > 0 &&
    dotCount > 0
  ) {
    if (
      lastDot >
      lastComma
    ) {
      text =
        text.replace(
          /,/g,
          ""
        );
    } else {
      text =
        text
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          );
    }
  } else if (
    commaCount > 0
  ) {
    const decimals =
      text.length -
      lastComma -
      1;

    if (
      commaCount === 1 &&
      (
        decimals === 1 ||
        decimals === 2
      )
    ) {
      text =
        text.replace(
          ",",
          "."
        );
    } else {
      text =
        text.replace(
          /,/g,
          ""
        );
    }
  } else if (
    dotCount > 1
  ) {
    const parts =
      text.split(".");

    const last =
      parts.pop() || "";

    if (
      last.length === 1 ||
      last.length === 2
    ) {
      text =
        `${parts.join("")}.${last}`;
    } else {
      text =
        `${parts.join("")}${last}`;
    }
  }

  const result =
    Number(text);

  return Number.isFinite(result)
    ? result
    : 0;
}

function makeStrictLocalDate(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) {
  const parts = [
    year,
    month,
    day,
    hour,
    minute,
    second
  ].map(Number);

  if (
    parts.some(
      part =>
        !Number.isFinite(part)
    ) ||
    parts[1] < 1 ||
    parts[1] > 12 ||
    parts[2] < 1 ||
    parts[2] > 31 ||
    parts[3] < 0 ||
    parts[3] > 23 ||
    parts[4] < 0 ||
    parts[4] > 59 ||
    parts[5] < 0 ||
    parts[5] > 59
  ) {
    return null;
  }

  const date =
    new Date(
      parts[0],
      parts[1] - 1,
      parts[2],
      parts[3],
      parts[4],
      parts[5]
    );

  /* JavaScript'in 09/21/2026 gibi değerleri başka yıla kaydırmasını engelle. */
  if (
    date.getFullYear() !==
      parts[0] ||
    date.getMonth() + 1 !==
      parts[1] ||
    date.getDate() !==
      parts[2]
  ) {
    return null;
  }

  return date;
}

function clockHour(
  rawHour,
  meridiem
) {
  let hour =
    Number(rawHour || 0);

  const marker =
    cleanText(meridiem)
      .toUpperCase();

  if (marker === "AM") {
    hour =
      hour === 12
        ? 0
        : hour;

  } else if (
    marker === "PM" &&
    hour < 12
  ) {
    hour += 12;
  }

  return hour;
}

function parseDate(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  if (
    typeof value === "number" &&
    value > 20000 &&
    value < 100000
  ) {
    const date =
      new Date(
        Math.round(
          (
            value -
            25569
          ) *
          86400 *
          1000
        )
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const text =
    String(value).trim();

  const iso =
    text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );

  if (iso) {
    return makeStrictLocalDate(
      iso[1],
      iso[2],
      iso[3],
      iso[4] || 0,
      iso[5] || 0,
      iso[6] || 0
    );
  }

  /*
    Bookimed dışa aktarımlarındaki slash tarihleri Amerikan biçimidir:
    09/01/2026 = 1 Eylül 2026
    09/21/2026 = 21 Eylül 2026
  */
  const slash =
    text.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
    );

  if (slash) {
    const first =
      Number(slash[1]);

    const second =
      Number(slash[2]);

    /* İlk parça 12'den büyükse kayıt açıkça gün/ay/yıl biçimindedir. */
    const dayFirst =
      first > 12 &&
      second <= 12;

    const month =
      dayFirst
        ? second
        : first;

    const day =
      dayFirst
        ? first
        : second;

    return makeStrictLocalDate(
      slash[3],
      month,
      day,
      clockHour(
        slash[4],
        slash[7]
      ),
      slash[5] || 0,
      slash[6] || 0
    );
  }

  const local =
    text.match(
      /^(\d{1,2})[.-](\d{1,2})[.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
    );

  if (local) {
    return makeStrictLocalDate(
      local[3],
      local[2],
      local[1],
      clockHour(
        local[4],
        local[7]
      ),
      local[5] || 0,
      local[6] || 0
    );
  }

  const fallback =
    new Date(text);

  return Number.isNaN(
    fallback.getTime()
  )
    ? null
    : fallback;
}

function dateParts(date) {
  if (!date) {
    return {
      year: 0,
      month: 0,
      day: 0
    };
  }

  return {
    year:
      date.getFullYear(),

    month:
      date.getMonth() + 1,

    day:
      date.getDate()
  };
}

function isoDateOnly(date) {
  if (!date) {
    return null;
  }

  const pad = (value) =>
    String(value)
      .padStart(
        2,
        "0"
      );

  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() + 1
    )}-` +
    `${pad(
      date.getDate()
    )}`
  );
}

function localIsoDateTime(date) {
  if (!date) {
    return null;
  }

  const pad = (value) =>
    String(value)
      .padStart(
        2,
        "0"
      );

  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() + 1
    )}-` +
    `${pad(
      date.getDate()
    )}` +
    `T${pad(
      date.getHours()
    )}:` +
    `${pad(
      date.getMinutes()
    )}:` +
    `${pad(
      date.getSeconds()
    )}`
  );
}

function ratio(
  numerator,
  denominator
) {
  return Number(
    denominator || 0
  ) > 0
    ? Number(
        numerator || 0
      ) /
      Number(
        denominator || 0
      )
    : 0;
}

function sumBy(
  rows,
  getter
) {
  return rows.reduce(
    (
      total,
      row
    ) =>
      total +
      Number(
        getter(row) || 0
      ),
    0
  );
}

function uniqueSorted(
  rows,
  key
) {
  return [
    ...new Set(
      rows
        .map(
          (row) =>
            row[key]
        )
        .filter(Boolean)
    )
  ].sort(
    (
      a,
      b
    ) =>
      String(a)
        .localeCompare(
          String(b),
          "tr"
        )
  );
}

/* =========================================================
   SELLERS
========================================================= */

const MAIN_SELLERS = [
  {
    key:
      "Şebnem Mammadova",

    label:
      "Şebnem",

    aliases: [
      "Şebnem Mammadova",
      "Sebnem Mammadova"
    ]
  },

  {
    key:
      "Alican Kulyyev",

    label:
      "Alican",

    aliases: [
      "Alican Kulyyev",
      "Alıcan Kulyyev"
    ]
  },

  {
    key:
      "Balzhan ADREISSOVA",

    label:
      "Balzhan",

    aliases: [
      "Balzhan ADREISSOVA",
      "Balzhan ABDREISSOVA"
    ]
  },

  {
    key:
      "ÇINARA AKYÜZ",

    label:
      "Çinara",

    aliases: [
      "ÇINARA AKYÜZ",
      "Çinara Akyüz",
      "CINARA AKYUZ"
    ]
  },

  {
    key:
      "Rana Ekiz",

    label:
      "Rana",

    aliases: [
      "Rana Ekiz"
    ]
  }
];

const SELLER_ALIAS_MAP =
  new Map();

for (
  const seller of
  MAIN_SELLERS
) {
  for (
    const alias of
    seller.aliases
  ) {
    SELLER_ALIAS_MAP.set(
      normalizeText(alias),
      seller
    );
  }
}

function sellerDefinition(value) {
  return (
    SELLER_ALIAS_MAP.get(
      normalizeText(value)
    ) ||
    null
  );
}

function sellerLabel(key) {
  return (
    MAIN_SELLERS.find(
      (
        seller
      ) =>
        seller.key ===
        key
    )?.label ||
    key
  );
}

function normalizeAnySeller(value) {
  const text =
    cleanText(value);

  if (!text) {
    return "Atanmamış";
  }

  const known =
    sellerDefinition(text);

  return (
    known?.key ||
    text
  );
}

function anySellerLabel(value) {
  const known =
    MAIN_SELLERS.find(
      (
        seller
      ) =>
        seller.key ===
        value
    );

  return (
    known?.label ||
    value
  );
}

/* =========================================================
   AUTH
========================================================= */

function getUsers() {
  try {
    const parsed =
      JSON.parse(
        process.env
          .USERS_JSON ||
        "{}"
      );

    if (
      Array.isArray(
        parsed
      )
    ) {
      return parsed.map(
        (
          user
        ) => ({
          username:
            String(
              user.username ||
              ""
            ),

          passwordHash:
            String(
              user.passwordHash ||
              user.hash ||
              ""
            ),

          role:
            user.role ||
            "admin",

          seller:
            user.seller ||
            ""
        })
      );
    }

    if (
      parsed &&
      typeof parsed ===
        "object"
    ) {
      return Object.entries(
        parsed
      ).map(
        ([
          username,
          value
        ]) => {
          if (
            value &&
            typeof value ===
              "object"
          ) {
            return {
              username,

              passwordHash:
                value.passwordHash ||
                value.hash ||
                "",

              role:
                value.role ||
                "admin",

              seller:
                value.seller ||
                ""
            };
          }

          return {
            username,

            passwordHash:
              String(
                value || ""
              ),

            role:
              "admin",

            seller:
              ""
          };
        }
      );
    }

    return [];

  } catch (
    error
  ) {
    console.error(
      "USERS_JSON okunamadı:",
      error.message
    );

    return [];
  }
}

function requireAuth(
  req,
  res,
  next
) {
  if (
    !req.session.user
  ) {
    return res
      .status(401)
      .json({
        error:
          "Oturum gerekli"
      });
  }

  next();
}

app.post(
  "/api/login",

  async (
    req,
    res
  ) => {
    try {
      const {
        username,
        password
      } =
        req.body ||
        {};

      const user =
        getUsers()
          .find(
            (
              item
            ) =>
              String(
                item.username ||
                ""
              ) ===
              String(
                username ||
                ""
              )
          );

      if (
        !user ||
        !user.passwordHash
      ) {
        return res
          .status(401)
          .json({
            error:
              "Kullanıcı adı veya şifre hatalı"
          });
      }

      const valid =
        await bcrypt.compare(
          String(
            password || ""
          ),
          String(
            user.passwordHash
          )
        );

      if (!valid) {
        return res
          .status(401)
          .json({
            error:
              "Kullanıcı adı veya şifre hatalı"
          });
      }

      req.session.user = {
        username:
          user.username,

        role:
          user.role ||
          "admin",

        seller:
          user.seller ||
          ""
      };

      return res.json({
        success:
          true,

        user:
          req.session.user
      });

    } catch (
      error
    ) {
      console.error(
        "Login error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Giriş sırasında hata oluştu"
        });
    }
  }
);

app.post(
  "/api/logout",

  (
    req,
    res
  ) => {
    req.session.destroy(
      () => {
        res.json({
          success:
            true
        });
      }
    );
  }
);

app.get(
  "/api/me",

  (
    req,
    res
  ) => {
    res.json({
      user:
        req.session.user ||
        null
    });
  }
);

/* =========================================================
   APPS SCRIPT CACHE
========================================================= */

let rawCache = null;
let rawCacheAt = 0;
let rawCachePromise = null;

let coreCache = null;
let coreCacheAt = 0;
let coreCachePromise = null;

async function loadAppsScriptData() {
  const base =
    process.env
      .APPS_SCRIPT_URL;

  const key =
    process.env
      .APPS_SCRIPT_API_KEY;

  if (
    !base ||
    !key
  ) {
    throw new Error(
      "Apps Script ayarları eksik."
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),

      APPS_SCRIPT_TIMEOUT_MS
    );

  try {
    /*
      Büyük tabloları tek mode=all yanıtında göndermek Google'ın
      HTML hata sayfası döndürmesine yol açabiliyor. Her sayfayı
      ayrı çağrıyla alıp sunucuda birleştiriyoruz.
    */
    const fetchSheet =
      async (
        sheetName
      ) => {
        const url =
          new URL(base);

        url.searchParams.set(
          "sheet",
          sheetName
        );

        url.searchParams.set(
          "key",
          key
        );

        const response =
          await fetch(
            url,
            {
              signal:
                controller.signal,

              redirect:
                "follow",

              cache:
                "no-store"
            }
          );

        const text =
          await response.text();

        let data;

        try {
          data =
            JSON.parse(text);

        } catch {
          console.error(
            `Apps Script JSON olmayan cevap (${sheetName}):`,
            text.slice(
              0,
              500
            )
          );

          throw new Error(
            `Apps Script ${sheetName} verisini geçerli JSON olarak döndürmedi.`
          );
        }

        if (
          !response.ok ||
          data.success ===
            false
        ) {
          throw new Error(
            data.error ||
            `Apps Script ${sheetName} HTTP ${response.status}`
          );
        }

        return Array.isArray(
          data.rows
        )
          ? data.rows
          : [];
      };

    const [
      lead,
      quote,
      won,
      targets
    ] =
      await Promise.all([
        fetchSheet(
          "Ham Lead"
        ),

        fetchSheet(
          "Ham Teklif"
        ),

        fetchSheet(
          "Ham Deal Won"
        ),

        fetchSheet(
          "Hedefler"
        )
      ]);

    rawCache = {
      lead,

      quote,

      won,

      targets,

      coordinator:
        []
    };

    rawCacheAt =
      Date.now();

    return rawCache;

  } catch (
    error
  ) {
    /* Bağlantı geçici olarak yavaşsa mevcut son başarılı veriyi koru. */
    if (rawCache) {
      console.warn(
        "Apps Script yenilenemedi; son başarılı önbellek kullanılıyor:",
        error?.message ||
        error
      );

      return rawCache;
    }

    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        `Google Sheets bağlantısı ${Math.round(APPS_SCRIPT_TIMEOUT_MS / 1000)} saniye içinde yanıt vermedi.`
      );
    }

    throw error;

  } finally {
    clearTimeout(
      timeout
    );
  }
}

async function fetchAppsScript() {
  if (
    rawCache &&
    Date.now() -
      rawCacheAt <
      CACHE_TTL_MS
  ) {
    return rawCache;
  }

  if (rawCachePromise) {
    return rawCachePromise;
  }

  rawCachePromise =
    loadAppsScriptData()
      .finally(
        () => {
          rawCachePromise =
            null;
        }
      );

  return rawCachePromise;
}

/* =========================================================
   TARGETS / PROJECTION
========================================================= */

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];

function defaultTargets() {
  return {
    1: 100000,
    2: 100000,
    3: 100000,
    4: 120000,
    5: 140000,
    6: 150000,
    7: 170000,
    8: 190000,
    9: 200000,
    10: 230000,
    11: 250000,
    12: 250000
  };
}

function parseTargets(
  rows
) {
  const targets = {
    ...defaultTargets()
  };

  for (
    const rawRow of
    rows || []
  ) {
    const lookup =
      makeLookup(rawRow);

    const monthName =
      cleanText(
        pick(
          lookup,
          "Ay",
          "Month"
        )
      );

    const index =
      MONTH_NAMES
        .findIndex(
          (
            name
          ) =>
            normalizeText(
              name
            ) ===
            normalizeText(
              monthName
            )
        );

    if (
      index < 0
    ) {
      continue;
    }

    const value =
      numberValue(
        pick(
          lookup,
          "Hedef (USD)",
          "Hedef USD",
          "Hedef",
          "Target USD"
        )
      );

    if (
      value > 0
    ) {
      targets[
        index + 1
      ] =
        value;
    }
  }

  return targets;
}

function istanbulToday() {
  const parts =
    new Intl
      .DateTimeFormat(
        "en-CA",
        {
          timeZone:
            TIMEZONE,

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit"
        }
      )
      .formatToParts(
        new Date()
      );

  const map =
    Object.fromEntries(
      parts.map(
        (
          part
        ) => [
          part.type,
          part.value
        ]
      )
    );

  return {
    year:
      Number(
        map.year
      ),

    month:
      Number(
        map.month
      ),

    day:
      Number(
        map.day
      )
  };
}

function daysInMonth(
  year,
  month
) {
  return new Date(
    year,
    month,
    0
  ).getDate();
}

function projectionFactorForMonth(
  month
) {
  const today =
    istanbulToday();

  if (
    today.year >
    YEAR
  ) {
    return 1;
  }

  if (
    today.year <
    YEAR
  ) {
    return 0;
  }

  if (
    month <
    today.month
  ) {
    return 1;
  }

  if (
    month >
    today.month
  ) {
    return 0;
  }

  const totalDays =
    daysInMonth(
      YEAR,
      month
    );

  const elapsed =
    Math.min(
      Math.max(
        today.day,
        1
      ),
      totalDays
    );

  return (
    totalDays /
    elapsed
  );
}

function projectWonRows(
  rows
) {
  const byMonth =
    new Map();

  for (
    const row of
    rows
  ) {
    const month =
      Number(
        row.month || 0
      );

    if (
      month < 1 ||
      month > 12
    ) {
      continue;
    }

    const bucket =
      byMonth.get(month) || {
        count: 0,
        sales: 0
      };

    bucket.count +=
      1;

    bucket.sales +=
      Number(
        row.amountUsd || 0
      );

    byMonth.set(
      month,
      bucket
    );
  }

  let expectedCount = 0;
  let expectedAmount = 0;

  for (
    let month = 1;
    month <= 12;
    month++
  ) {
    const bucket =
      byMonth.get(month) || {
        count: 0,
        sales: 0
      };

    const factor =
      projectionFactorForMonth(
        month
      );

    expectedCount +=
      bucket.count *
      factor;

    expectedAmount +=
      bucket.sales *
      factor;
  }

  return {
    expectedDealWon:
      Math.round(
        expectedCount
      ),

    expectedAmount
  };
}

function projectionMeta(
  period
) {
  const today =
    istanbulToday();

  if (
    period === "genel"
  ) {
    return {
      basis:
        "monthly-run-rate",

      currentYear:
        today.year,

      currentMonth:
        today.month,

      currentDay:
        today.day,

      currentMonthDays:
        daysInMonth(
          today.year,
          today.month
        ),

      timezone:
        TIMEZONE
    };
  }

  const month =
    Number(period);

  const totalDays =
    daysInMonth(
      YEAR,
      month
    );

  const factor =
    projectionFactorForMonth(
      month
    );

  return {
    basis:
      "monthly-run-rate",

    year:
      YEAR,

    month,

    elapsedDays:
      today.year === YEAR &&
      today.month === month
        ? Math.min(
            today.day,
            totalDays
          )
        : month <
            today.month ||
          today.year >
            YEAR
          ? totalDays
          : 0,

    totalDays,

    factor,

    timezone:
      TIMEZONE
  };
}

/* =========================================================
   MAIN DATA NORMALIZATION
========================================================= */

function commonFields(
  lookup
) {
  const sellerRaw =
    cleanText(
      pick(
        lookup,
        "Sorumlu Kişi",
        "Sorumlu Kisi"
      )
    );

  const seller =
    sellerDefinition(
      sellerRaw
    );

  return {
    id:
      normalizeId(
        pick(
          lookup,
          "ID",
          "Bitrix ID",
          "BitrixID"
        )
      ),

    seller:
      seller?.key ||
      "",

    sellerLabel:
      seller?.label ||
      "",

    coordinator:
      cleanText(
        pick(
          lookup,
          "Source HBYS",
          "Source",
          "Bookimed Coordinators",
          "Bookimed Coordinator"
        )
      ),

    department:
      cleanText(
        pick(
          lookup,
          "Department HBYS",
          "Department"
        )
      ),

    doctor:
      cleanText(
        pick(
          lookup,
          "Doctor HBYS",
          "Doctor"
        )
      ),

    source:
      cleanText(
        pick(
          lookup,
          "Source HBYS",
          "Source"
        )
      )
  };
}

function normalizeLeadRow(
  rawRow
) {
  const lookup =
    makeLookup(rawRow);

  const common =
    commonFields(
      lookup
    );

  const startDate =
    parseDate(
      pick(
        lookup,
        "Başlangıç tarihi",
        "Başlangıç Tarihi",
        "Baslangic tarihi",
        "Baslangic Tarihi"
      )
    );

  const newLeadDate =
    parseDate(
      pickStageTime(
        lookup,
        "newlead"
      )
    );

  const quotedDate =
    parseDate(
      pickStageTime(
        lookup,
        "quoted"
      )
    );

  const speedStartDate =
    newLeadDate ||
    startDate;

  /*
    Lead'in ait olduğu ay önce gerçek New Lead geliş tarihidir.
    Bu alan yoksa Başlangıç tarihi yedek olarak kullanılır.
  */
  const date =
    newLeadDate ||
    startDate;

  const parts =
    dateParts(date);

  const newLeadParts =
    dateParts(
      newLeadDate
    );

  const quotedParts =
    dateParts(
      quotedDate
    );

  return {
    ...common,

    patientName:
      cleanText(
        pick(
          lookup,
          "Ad",
          "Hasta Adı",
          "Hasta Adi",
          "Patient Name"
        )
      ),

    date,

    year:
      parts.year,

    month:
      parts.month,

    day:
      parts.day,

    newLeadDate,

    newLeadYear:
      newLeadParts.year,

    newLeadMonth:
      newLeadParts.month,

    newLeadDay:
      newLeadParts.day,

    startDate,

    speedStartDate,

    quotedDate,

    quotedYear:
      quotedParts.year,

    quotedMonth:
      quotedParts.month,

    quotedDay:
      quotedParts.day,

    stage:
      cleanText(
        pick(
          lookup,
          "Anlaşma Aşaması",
          "Anlasma Asamasi",
          "Deal Stage",
          "Stage"
        )
      )
  };
}

function normalizeQuoteRow(
  rawRow
) {
  const lookup =
    makeLookup(rawRow);

  const common =
    commonFields(
      lookup
    );

  const quotedDate =
    parseDate(
      pickStageTime(
        lookup,
        "quoted"
      )
    );

  const newLeadDate =
    parseDate(
      pickStageTime(
        lookup,
        "newlead"
      )
    );

  const startDate =
    parseDate(
      pick(
        lookup,
        "Başlangıç tarihi",
        "Başlangıç Tarihi",
        "Baslangic tarihi",
        "Baslangic Tarihi",
        "Start Date"
      )
    );

  /* Teklif hızı başlangıcı: önce New Lead, yoksa Başlangıç Tarihi. */
  const speedStartDate =
    newLeadDate ||
    startDate;

  const parts =
    dateParts(quotedDate);

  const newLeadParts =
    dateParts(
      newLeadDate
    );

  return {
    ...common,

    patientName:
      cleanText(
        pick(
          lookup,
          "Ad",
          "Hasta Adı",
          "Hasta Adi",
          "Patient Name",
          "Name"
        )
      ),

    date:
      quotedDate,

    quotedDate,

    quotedYear:
      parts.year,

    quotedMonth:
      parts.month,

    quotedDay:
      parts.day,

    newLeadDate,

    newLeadYear:
      newLeadParts.year,

    newLeadMonth:
      newLeadParts.month,

    newLeadDay:
      newLeadParts.day,

    startDate,

    speedStartDate,

    year:
      parts.year,

    month:
      parts.month,

    day:
      parts.day,

    amountUsd:
      numberValue(
        pick(
          lookup,
          "USD Karşılığı",
          "USD Karsiligi",
          "Tutar USD Karşılığı",
          "Tutar USD Karsiligi"
        )
      )
  };
}

function normalizeWonRow(
  rawRow
) {
  const lookup =
    makeLookup(rawRow);

  const common =
    commonFields(
      lookup
    );

  const date =
    parseDate(
      pick(
        lookup,
        "YD Deal Won - Arrived Time",
        "YD Deal Won Arrived Time"
      )
    );

  const parts =
    dateParts(date);

  return {
    ...common,

    date,

    year:
      parts.year,

    month:
      parts.month,

    day:
      parts.day,

    amountUsd:
      numberValue(
        pick(
          lookup,
          "USD Karşılığı",
          "USD Karsiligi",
          "Tutar USD Karşılığı",
          "Tutar USD Karsiligi"
        )
      )
  };
}

function dedupeRows(rows) {
  const seen =
    new Set();

  const result = [];

  let duplicatesRemoved = 0;
  let blankIds = 0;

  for (
    const row of
    rows
  ) {
    if (!row.id) {
      blankIds +=
        1;

      result.push(row);
      continue;
    }

    if (
      seen.has(
        row.id
      )
    ) {
      duplicatesRemoved +=
        1;

      continue;
    }

    seen.add(
      row.id
    );

    result.push(row);
  }

  return {
    rows:
      result,

    stats: {
      rawRows:
        rows.length,

      rowsAfterDedup:
        result.length,

      duplicatesRemoved,

      blankIds,

      uniqueIds:
        seen.size
    }
  };
}

function mergeRowsForSpeed(
  rows
) {
  const groups =
    new Map();

  const blankIdRows = [];

  for (
    const row of rows
  ) {
    if (!row.id) {
      blankIdRows.push(
        row
      );
      continue;
    }

    if (!groups.has(row.id)) {
      groups.set(
        row.id,
        []
      );
    }

    groups
      .get(row.id)
      .push(row);
  }

  const merged = [];

  for (
    const group of groups.values()
  ) {
    /* En dolu satırı temel al; tarihleri grubun tamamından birleştir. */
    const ranked =
      [...group]
        .sort(
          (a, b) =>
            Number(Boolean(b.newLeadDate)) +
              Number(Boolean(b.quotedDate)) * 2 +
              Number(Boolean(b.seller)) -
            (
              Number(Boolean(a.newLeadDate)) +
              Number(Boolean(a.quotedDate)) * 2 +
              Number(Boolean(a.seller))
            )
        );

    const base =
      ranked[0];

    const newLeadDates =
      group
        .map(row => row.newLeadDate)
        .filter(Boolean)
        .sort((a, b) => a - b);

    const allQuotedDates =
      group
        .map(row => row.quotedDate)
        .filter(Boolean)
        .sort((a, b) => a - b);

    const newLeadDate =
      newLeadDates[0] ||
      null;

    const quotedDate =
      (
        newLeadDate
          ? allQuotedDates.find(
              date =>
                date >=
                newLeadDate
            )
          : allQuotedDates[0]
      ) ||
      null;

    const newLeadParts =
      dateParts(
        newLeadDate
      );

    const quotedParts =
      dateParts(
        quotedDate
      );

    merged.push({
      ...base,
      newLeadDate,
      newLeadYear:
        newLeadParts.year,
      newLeadMonth:
        newLeadParts.month,
      newLeadDay:
        newLeadParts.day,
      quotedDate,
      quotedYear:
        quotedParts.year,
      quotedMonth:
        quotedParts.month,
      quotedDay:
        quotedParts.day,
      speedStartDate:
        newLeadDate
    });
  }

  return {
    rows: [
      ...merged,
      ...blankIdRows
    ],

    stats: {
      rawRows:
        rows.length,
      mergedRows:
        merged.length +
        blankIdRows.length,
      idsWithMultipleRows:
        [...groups.values()]
          .filter(group => group.length > 1)
          .length
    }
  };
}

function buildIdMap(rows) {
  const map =
    new Map();

  for (
    const row of
    rows
  ) {
    if (
      row.id &&
      !map.has(
        row.id
      )
    ) {
      map.set(
        row.id,
        row
      );
    }
  }

  return map;
}

function enrichRows(
  rows,
  maps
) {
  const stats = {
    totalRows:
      rows.length,

    rowsEnriched:
      0,

    coordinator:
      0,

    department:
      0,

    doctor:
      0,

    source:
      0,

    patientName:
      0
  };

  const enriched =
    rows.map(
      (
        row
      ) => {
        if (!row.id) {
          return row;
        }

        const output = {
          ...row
        };

        let changed =
          false;

        for (
          const field of [
            "coordinator",
            "department",
            "doctor",
            "source",
            "patientName"
          ]
        ) {
          if (
            cleanText(
              output[field]
            )
          ) {
            continue;
          }

          for (
            const map of
            maps
          ) {
            const sourceRow =
              map.get(
                row.id
              );

            if (!sourceRow) {
              continue;
            }

            const value =
              cleanText(
                sourceRow[field]
              );

            if (!value) {
              continue;
            }

            output[field] =
              value;

            stats[field] +=
              1;

            changed =
              true;

            break;
          }
        }

        if (changed) {
          stats.rowsEnriched +=
            1;
        }

        return output;
      }
    );

  return {
    rows:
      enriched,

    stats
  };
}

/* =========================================================
   HAM KOORDİNATÖR NORMALIZATION
========================================================= */

const SALES_STATUS_KEYS =
  new Set([
    "appointmentbooked",
    "arrived",
    "successful"
  ]);

const STATUS_RANK = {
  successful: 30,
  arrived: 20,
  appointmentbooked: 10
};

function normalizeCoordinatorStatus(
  value
) {
  const raw =
    cleanText(value);

  const key =
    normalizeText(raw);

  const labels = {
    appointmentbooked:
      "Appointment Booked",

    arrived:
      "Arrived",

    successful:
      "Successful",

    offersent:
      "Offer sent",

    new:
      "New",

    rejected:
      "Rejected",

    inprocess:
      "In process",

    documentsadded:
      "Documents added"
  };

  return {
    raw,

    key,

    label:
      labels[key] ||
      raw ||
      "Belirsiz",

    isSale:
      SALES_STATUS_KEYS.has(
        key
      ),

    rank:
      STATUS_RANK[key] ||
      0
  };
}

function normalizeCoordinatorRow(
  rawRow
) {
  const lookup =
    makeLookup(rawRow);

  const status =
    normalizeCoordinatorStatus(
      pick(
        lookup,
        "Kart Durumu",
        "Status"
      )
    );

  const seller =
    normalizeAnySeller(
      pick(
        lookup,
        "Bizdeki Satıcı",
        "Bizdeki Satici",
        "Hastane Satıcısı",
        "Hastane Saticisi"
      )
    );

  const date =
    parseDate(
      pick(
        lookup,
        "Başlangıç tarihi",
        "Başlangıç Tarihi",
        "Baslangic tarihi",
        "Baslangic Tarihi",
        "New Lead Arrive Time",
        "New Lead Arrived Time",
        "YD New Lead - Arrived Time",
        "YD New Lead Arrived Time",
        "Created Time",
        "Created Date",
        "Tarih",
        "Date"
      )
    );

  const parts =
    dateParts(date);

  return {
    id:
      normalizeId(
        pick(
          lookup,
          "Bookimed ID",
          "BookimedID",
          "CaseID",
          "Case ID"
        )
      ),

    statusKey:
      status.key,

    status:
      status.label,

    statusRaw:
      status.raw,

    isSale:
      status.isSale,

    statusRank:
      status.rank,

    coordinator:
      cleanText(
        pick(
          lookup,
          "Bookimed Koordinatörü",
          "Bookimed Koordinatoru",
          "Bookimed Manager",
          "Coordinator"
        )
      ) ||
      "Belirsiz",

    seller,

    sellerLabel:
      anySellerLabel(
        seller
      ),

    date,

    year:
      parts.year,

    month:
      parts.month,

    day:
      parts.day,

    department:
      cleanText(
        pick(
          lookup,
          "Bölüm",
          "Bolum",
          "Department"
        )
      ) ||
      "Belirsiz / Diğer"
  };
}

/*
  Aynı Bookimed ID birden fazla satırda varsa
  iki kez vaka saymıyoruz.

  Eğer duplicate kayıtların statüsü farklıysa:
  Successful > Arrived > Appointment Booked
  statüsü korunur.

  Böylece conversion eksik hesaplanmaz.
*/
function dedupeCoordinatorRows(
  rows
) {
  const map =
    new Map();

  const blankRows = [];

  let duplicatesRemoved =
    0;

  for (
    const row of
    rows
  ) {
    if (!row.id) {
      blankRows.push(
        row
      );

      continue;
    }

    if (
      !map.has(
        row.id
      )
    ) {
      map.set(
        row.id,
        {
          ...row
        }
      );

      continue;
    }

    duplicatesRemoved +=
      1;

    const existing =
      map.get(
        row.id
      );

    if (
      row.statusRank >
      existing.statusRank
    ) {
      existing.statusKey =
        row.statusKey;

      existing.status =
        row.status;

      existing.statusRaw =
        row.statusRaw;

      existing.isSale =
        row.isSale;

      existing.statusRank =
        row.statusRank;
    }

    if (
      (
        !existing.coordinator ||
        existing.coordinator ===
          "Belirsiz"
      ) &&
      row.coordinator
    ) {
      existing.coordinator =
        row.coordinator;
    }

    if (
      (
        !existing.seller ||
        existing.seller ===
          "Atanmamış"
      ) &&
      row.seller
    ) {
      existing.seller =
        row.seller;

      existing.sellerLabel =
        row.sellerLabel;
    }

    if (
      (
        !existing.department ||
        existing.department ===
          "Belirsiz / Diğer"
      ) &&
      row.department
    ) {
      existing.department =
        row.department;
    }
  }

  return {
    rows: [
      ...map.values(),
      ...blankRows
    ],

    stats: {
      rawRows:
        rows.length,

      uniqueIds:
        map.size,

      blankIds:
        blankRows.length,

      duplicatesRemoved,

      rowsAfterDedup:
        map.size +
        blankRows.length
    }
  };
}

/* =========================================================
   CORE DATA
========================================================= */

async function buildCoreData() {
  const raw =
    await fetchAppsScript();

  const normalizedLeadRows =
    raw.lead.map(
      normalizeLeadRow
    );

  const leadDedup =
    dedupeRows(
      normalizedLeadRows
    );

  const normalizedQuoteRows =
    raw.quote.map(
      normalizeQuoteRow
    );

  const quoteDedup =
    dedupeRows(
      normalizedQuoteRows
    );

  const quoteSpeedMerged =
    mergeRowsForSpeed(
      normalizedQuoteRows
    );

  const wonDedup =
    dedupeRows(
      raw.won.map(
        normalizeWonRow
      )
    );

  const coordinatorDedup =
    dedupeCoordinatorRows(
      raw.coordinator.map(
        normalizeCoordinatorRow
      )
    );

  const leadIdMap =
    buildIdMap(
      leadDedup.rows
    );

  /*
    Koordinatör satırında tarih yoksa aynı Bitrix/Bookimed ID'li
    Ham Lead kaydının New Lead (yoksa başlangıç) tarihini kullan.
  */
  const legacyCoordinatorRows =
    coordinatorDedup.rows.map(
      (
        row
      ) => {
        if (row.date) {
          return row;
        }

        const lead =
          row.id
            ? leadIdMap.get(
                row.id
              )
            : null;

        const date =
          lead?.newLeadDate ||
          lead?.date ||
          null;

        const parts =
          dateParts(date);

        return {
          ...row,
          date,
          year:
            parts.year,
          month:
            parts.month,
          day:
            parts.day
        };
      }
    );

  const quoteEnrichment =
    enrichRows(
      quoteDedup.rows,
      [
        leadIdMap
      ]
    );

  const quoteIdMap =
    buildIdMap(
      quoteEnrichment.rows
    );

  const wonEnrichment =
    enrichRows(
      wonDedup.rows,
      [
        quoteIdMap,
        leadIdMap
      ]
    );

  const wonIdMap =
    buildIdMap(
      wonEnrichment.rows
    );

  /*
    Yeni RU ekip yapısında aracı bilgisi Source HBYS sütunundadır.
    Ayrı bir Ham Koordinatör sayfasına ihtiyaç duymadan, her lead'i
    teklif ve satış tablolarındaki aynı ID ile eşleştirerek aracı
    performans satırlarını oluştururuz.
  */
  const coordinatorRows =
    leadDedup.rows
      .filter(
        row =>
          row.id &&
          row.seller &&
          row.coordinator
      )
      .map(
        row => {
          const isSale =
            wonIdMap.has(row.id);

          const isQuoted =
            quoteIdMap.has(row.id);

          const date =
            row.newLeadDate ||
            row.date ||
            null;

          const parts =
            dateParts(date);

          return {
            ...row,
            date,
            year: parts.year,
            month: parts.month,
            day: parts.day,
            statusKey:
              isSale
                ? "successful"
                : isQuoted
                  ? "appointmentbooked"
                  : "lead",
            status:
              isSale
                ? "Satış"
                : isQuoted
                  ? "Teklif"
                  : "Lead",
            statusRaw:
              isSale
                ? "Deal won"
                : isQuoted
                  ? "Quoted"
                  : "Lead",
            isQuoted:
              isQuoted ||
              isSale,
            isSale,
            statusRank:
              isSale
                ? 3
                : isQuoted
                  ? 2
                  : 1
          };
        }
      );

  const leadRows =
    leadDedup.rows.filter(
      (
        row
      ) =>
        row.seller &&
        row.year ===
          YEAR
    );

  /*
    Teklif cevap hızı yalnızca Ham Teklif sayfasından alınır.
    Aynı ID'nin farklı satırlarındaki tarihler kaybedilmeden birleştirilir.
  */
  const quoteSpeedRows =
    quoteSpeedMerged.rows.filter(
      (
        row
      ) =>
        row.seller
    );

  const quoteRows =
    quoteEnrichment.rows.filter(
      (
        row
      ) =>
        row.seller &&
        row.year ===
          YEAR
    );

  const wonRows =
    wonEnrichment.rows.filter(
      (
        row
      ) =>
        row.seller &&
        row.year ===
          YEAR
    );

  const allRows = [
    ...leadRows,
    ...quoteRows,
    ...wonRows
  ];

  coreCache = {
    leadRows,

    quoteSpeedRows,

    quoteRows,

    wonRows,

    coordinatorRows:
      coordinatorRows,

    leadIdMap,

    quoteIdMap,

    wonIdMap,

    targets:
      parseTargets(
        raw.targets
      ),

    options: {
      sellers:
        MAIN_SELLERS.map(
          (
            seller
          ) => ({
            value:
              seller.key,

            label:
              seller.label
          })
        ),

      coordinators:
        uniqueSorted(
          allRows,
          "coordinator"
        ),

      departments:
        uniqueSorted(
          allRows,
          "department"
        ),

      doctors:
        uniqueSorted(
          allRows,
          "doctor"
        ),

      sources:
        uniqueSorted(
          allRows,
          "source"
        )
    },

    dataQuality: {
      lead:
        leadDedup.stats,

      quoteSpeed:
        quoteSpeedMerged.stats,

      quote:
        quoteDedup.stats,

      won:
        wonDedup.stats,

      coordinator:
        coordinatorDedup.stats,

      totalDuplicatesRemoved:
        leadDedup.stats
          .duplicatesRemoved +
        quoteDedup.stats
          .duplicatesRemoved +
        wonDedup.stats
          .duplicatesRemoved +
        coordinatorDedup.stats
          .duplicatesRemoved,

      enrichment: {
        quote:
          quoteEnrichment.stats,

        won:
          wonEnrichment.stats
      }
    }
  };

  coreCacheAt =
    Date.now();

  return coreCache;
}

function startCoreRefresh() {
  if (!coreCachePromise) {
    coreCachePromise =
      buildCoreData()
        .finally(
          () => {
            coreCachePromise =
              null;
          }
        );
  }

  return coreCachePromise;
}

async function getCoreData(
  options = {}
) {
  const allowStale =
    options.allowStale !==
    false;

  if (
    coreCache &&
    Date.now() -
      coreCacheAt <
      CACHE_TTL_MS
  ) {
    return coreCache;
  }

  if (
    coreCache &&
    allowStale
  ) {
    startCoreRefresh()
      .catch(
        error => {
          console.error(
            "Arka plan veri yenileme hatası:",
            error.message
          );
        }
      );

    return coreCache;
  }

  return startCoreRefresh();
}

/* =========================================================
   MAIN FILTERS
========================================================= */

function userSellerKey(user) {
  if (
    !user?.seller
  ) {
    return "";
  }

  return (
    sellerDefinition(
      user.seller
    )?.key ||
    user.seller
  );
}

function matchesDimensions(
  row,
  filters,
  user
) {
  if (
    user?.role ===
      "seller" &&
    user.seller &&
    row.seller !==
      userSellerKey(
        user
      )
  ) {
    return false;
  }

  if (
    filters.seller !==
      "Tümü" &&
    row.seller !==
      filters.seller
  ) {
    return false;
  }

  if (
    filters.coordinator !==
      "Tümü" &&
    row.coordinator !==
      filters.coordinator
  ) {
    return false;
  }

  if (
    filters.department !==
      "Tümü" &&
    row.department !==
      filters.department
  ) {
    return false;
  }

  if (
    filters.doctor !==
      "Tümü" &&
    row.doctor !==
      filters.doctor
  ) {
    return false;
  }

  if (
    filters.source !==
      "Tümü" &&
    row.source !==
      filters.source
  ) {
    return false;
  }

  return true;
}

function visibleSellers(
  filters,
  user
) {
  if (
    user?.role ===
      "seller" &&
    user.seller
  ) {
    const key =
      userSellerKey(
        user
      );

    return MAIN_SELLERS.filter(
      (
        seller
      ) =>
        seller.key ===
        key
    );
  }

  if (
    filters.seller !==
      "Tümü"
  ) {
    return MAIN_SELLERS.filter(
      (
        seller
      ) =>
        seller.key ===
        filters.seller
    );
  }

  return MAIN_SELLERS;
}

function periodMatch(
  row,
  period
) {
  return period ===
    "genel"
    ? true
    : row.month ===
      Number(period);
}

function targetForPeriod(
  period,
  targets
) {
  if (
    period ===
    "genel"
  ) {
    return Object.values(
      targets
    ).reduce(
      (
        total,
        value
      ) =>
        total +
        Number(
          value || 0
        ),
      0
    );
  }

  return Number(
    targets[
      Number(period)
    ] || 0
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

function aggregate(
  data,
  filters,
  user
) {
  const lead =
    data.leadRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  const quote =
    data.quoteRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  const won =
    data.wonRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  const quoteAmount =
    sumBy(
      quote,
      (
        row
      ) =>
        row.amountUsd
    );

  const sales =
    sumBy(
      won,
      (
        row
      ) =>
        row.amountUsd
    );

  const target =
    targetForPeriod(
      filters.period,
      data.targets
    );

  const expected =
    projectWonRows(
      won
    );

  const sellerPerformance =
    visibleSellers(
      filters,
      user
    )
      .map(
        (
          seller
        ) => {
          const sellerLead =
            lead.filter(
              (
                row
              ) =>
                row.seller ===
                seller.key
            );

          const sellerQuote =
            quote.filter(
              (
                row
              ) =>
                row.seller ===
                seller.key
            );

          const sellerWon =
            won.filter(
              (
                row
              ) =>
                row.seller ===
                seller.key
            );

          const sellerExpected =
            projectWonRows(
              sellerWon
            );

          const sellerSales =
            sumBy(
              sellerWon,
              (
                row
              ) =>
                row.amountUsd
            );

          return {
            seller:
              seller.key,

            sellerLabel:
              seller.label,

            lead:
              sellerLead.length,

            quote:
              sellerQuote.length,

            expectedDealWon:
              sellerExpected
                .expectedDealWon,

            expectedAmount:
              sellerExpected
                .expectedAmount,

            won:
              sellerWon.length,

            quoteAmount:
              sumBy(
                sellerQuote,
                (
                  row
                ) =>
                  row.amountUsd
              ),

            sales:
              sellerSales,

            salesDetails:
              sellerWon
                .map(
                  (
                    row
                  ) => ({
                    id:
                      row.id ||
                      "-",

                    patientName:
                      row.patientName ||
                      "İsimsiz vaka",

                    dealWonDate:
                      isoDateOnly(
                        row.date
                      ),

                    amountUsd:
                      Number(
                        row.amountUsd ||
                        0
                      ),

                    coordinator:
                      row.coordinator ||
                      "-",

                    department:
                      row.department ||
                      "-",

                    doctor:
                      row.doctor ||
                      "-"
                  })
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    String(
                      b.dealWonDate ||
                      ""
                    ).localeCompare(
                      String(
                        a.dealWonDate ||
                        ""
                      )
                    ) ||
                    b.amountUsd -
                      a.amountUsd
                ),

            conversion:
              ratio(
                sellerWon.length,
                sellerLead.length
              ),

            quoteToWon:
              ratio(
                sellerWon.length,
                sellerQuote.length
              ),

            expectedToWon:
              ratio(
                sellerWon.length,
                sellerExpected
                  .expectedDealWon
              ),

            avgSale:
              ratio(
                sellerSales,
                sellerWon.length
              )
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.sales -
            a.sales ||
          b.won -
            a.won ||
          b.expectedAmount -
            a.expectedAmount
      );

  const breakdowns = {};

  for (
    const [
      name,
      key
    ] of [
      [
        "coordinators",
        "coordinator"
      ],
      [
        "departments",
        "department"
      ],
      [
        "doctors",
        "doctor"
      ],
      [
        "sources",
        "source"
      ]
    ]
  ) {
    const map =
      new Map();

    for (
      const row of
      won
    ) {
      const itemName =
        row[key] ||
        "Belirsiz";

      const current =
        map.get(
          itemName
        ) || {
          name:
            itemName,

          count:
            0,

          sales:
            0
        };

      current.count +=
        1;

      current.sales +=
        Number(
          row.amountUsd || 0
        );

      map.set(
        itemName,
        current
      );
    }

    breakdowns[name] =
      [
        ...map.values()
      ].sort(
        (
          a,
          b
        ) =>
          b.sales -
            a.sales ||
          b.count -
            a.count
      );
  }

  return {
    kpis: {
      lead:
        lead.length,

      quoteCount:
        quote.length,

      expectedDealWon:
        expected
          .expectedDealWon,

      expectedAmount:
        expected
          .expectedAmount,

      dealWon:
        won.length,

      quoteAmount,

      sales,

      target,

      targetPct:
        ratio(
          sales,
          target
        ),

      remaining:
        Math.max(
          target -
            sales,
          0
        ),

      conversion:
        ratio(
          won.length,
          lead.length
        ),

      quoteToWon:
        ratio(
          won.length,
          quote.length
        ),

      expectedToWon:
        ratio(
          won.length,
          expected
            .expectedDealWon
        )
    },

    sellerPerformance,

    funnel: {
      lead:
        lead.length,

      quoted:
        quote.length,

      expectedDealWon:
        expected
          .expectedDealWon,

      expectedAmount:
        expected
          .expectedAmount,

      won:
        won.length
    },

    breakdowns,

    projection:
      projectionMeta(
        filters.period
      )
  };
}

function buildMonthlySummary(
  data,
  filters,
  user
) {
  return Array.from(
    {
      length: 12
    },

    (
      _,
      index
    ) => {
      const result =
        aggregate(
          data,
          {
            ...filters,
            period:
              String(
                index + 1
              )
          },
          user
        );

      return {
        month:
          index + 1,

        monthName:
          MONTH_NAMES[
            index
          ],

        ...result.kpis
      };
    }
  );
}

function buildOpenCases(
  data,
  filters,
  user
) {
  const rows =
    data.quoteRows
      .filter(
        (
          row
        ) =>
          matchesDimensions(
            row,
            filters,
            user
          ) &&
          periodMatch(
            row,
            filters.period
          ) &&
          row.id &&
          !data.wonIdMap.has(
            row.id
          )
      )
      .map(
        (
          row
        ) => {
          const ageMinutes = row.date
            ? Math.max(0, (Date.now() - row.date.getTime()) / 60000)
            : 0;

          return {
            id:
              row.id,

            patientName:
              row.patientName ||
              "",

            seller:
              row.seller,

            sellerLabel:
              row.sellerLabel,

            department:
              row.department ||
              "",

            doctor:
              row.doctor ||
              "",

            coordinator:
              row.coordinator ||
              "",

            source:
              row.source ||
              "",

            quoteDate:
              isoDateOnly(
                row.date
              ),

            lastActionAt:
              localIsoDateTime(
                row.date
              ),

            ageMinutes,

            amountUsd:
              Number(
                row.amountUsd || 0
              )
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.amountUsd -
          a.amountUsd
      );

  return {
    count:
      rows.length,

    totalAmount:
      sumBy(
        rows,
        (
          row
        ) =>
          row.amountUsd
      ),

    rows
  };
}

function buildDepartmentSales(
  data,
  filters,
  user
) {
  const leadRows =
    data.leadRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  const quoteRows =
    data.quoteRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  const wonRows =
    data.wonRows.filter(
      (
        row
      ) =>
        matchesDimensions(
          row,
          filters,
          user
        ) &&
        periodMatch(
          row,
          filters.period
        )
    );

  function makeRows(
    sellerKey = null
  ) {
    const map =
      new Map();

    function getDepartment(
      name
    ) {
      const key =
        cleanText(
          name
        ) ||
        "Belirsiz";

      if (
        !map.has(
          key
        )
      ) {
        map.set(
          key,
          {
            department:
              key,

            lead: 0,

            quote: 0,

            quoteAmount: 0,

            salesCount: 0,

            salesAmount: 0
          }
        );
      }

      return map.get(
        key
      );
    }

    for (
      const row of
      leadRows
    ) {
      if (
        sellerKey &&
        row.seller !==
          sellerKey
      ) {
        continue;
      }

      getDepartment(
        row.department
      ).lead +=
        1;
    }

    for (
      const row of
      quoteRows
    ) {
      if (
        sellerKey &&
        row.seller !==
          sellerKey
      ) {
        continue;
      }

      const item =
        getDepartment(
          row.department
        );

      item.quote +=
        1;

      item.quoteAmount +=
        Number(
          row.amountUsd || 0
        );
    }

    for (
      const row of
      wonRows
    ) {
      if (
        sellerKey &&
        row.seller !==
          sellerKey
      ) {
        continue;
      }

      const item =
        getDepartment(
          row.department
        );

      item.salesCount +=
        1;

      item.salesAmount +=
        Number(
          row.amountUsd || 0
        );
    }

    const rows = [
      ...map.values()
    ];

    const filteredWon =
      sellerKey
        ? wonRows.filter(
            (
              row
            ) =>
              row.seller ===
              sellerKey
          )
        : wonRows;

    const totalExpected =
      projectWonRows(
        filteredWon
      );

    const totalSales =
      sumBy(
        rows,
        (
          row
        ) =>
          row.salesAmount
      );

    for (
      const row of
      rows
    ) {
      const departmentWon =
        filteredWon.filter(
          (
            won
          ) =>
            (
              cleanText(
                won.department
              ) ||
              "Belirsiz"
            ) ===
            row.department
        );

      const departmentExpected =
        projectWonRows(
          departmentWon
        );

      row.expectedDealWon =
        departmentExpected
          .expectedDealWon;

      row.expectedAmount =
        departmentExpected
          .expectedAmount;

      row.expectedShare =
        ratio(
          row.expectedAmount,
          totalExpected
            .expectedAmount
        );

      row.salesShare =
        ratio(
          row.salesAmount,
          totalSales
        );

      row.leadToSale =
        ratio(
          row.salesCount,
          row.lead
        );

      row.quoteToSale =
        ratio(
          row.salesCount,
          row.quote
        );

      row.expectedToSale =
        ratio(
          row.salesCount,
          row.expectedDealWon
        );

      row.avgSale =
        ratio(
          row.salesAmount,
          row.salesCount
        );
    }

    rows.sort(
      (
        a,
        b
      ) =>
        b.salesAmount -
          a.salesAmount ||
        b.salesCount -
          a.salesCount ||
        b.expectedAmount -
          a.expectedAmount
    );

    return {
      rows,

      totals: {
        lead:
          sumBy(
            rows,
            (
              row
            ) =>
              row.lead
          ),

        quote:
          sumBy(
            rows,
            (
              row
            ) =>
              row.quote
          ),

        quoteAmount:
          sumBy(
            rows,
            (
              row
            ) =>
              row.quoteAmount
          ),

        expectedDealWon:
          totalExpected
            .expectedDealWon,

        expectedAmount:
          totalExpected
            .expectedAmount,

        salesCount:
          sumBy(
            rows,
            (
              row
            ) =>
              row.salesCount
          ),

        salesAmount:
          totalSales
      }
    };
  }

  return {
    period:
      filters.period,

    general:
      makeRows(),

    sellers:
      visibleSellers(
        filters,
        user
      ).map(
        (
          seller
        ) => ({
          seller:
            seller.key,

          sellerLabel:
            seller.label,

          ...makeRows(
            seller.key
          )
        })
      )
  };
}

function buildDoctorSales(
  data,
  filters,
  user
) {
  const applies =
    (
      row
    ) =>
      matchesDimensions(
        row,
        filters,
        user
      ) &&
      periodMatch(
        row,
        filters.period
      );

  const leadRows =
    data.leadRows.filter(applies);

  const quoteRows =
    data.quoteRows.filter(applies);

  const wonRows =
    data.wonRows.filter(applies);

  const map =
    new Map();

  function getDoctor(
    name
  ) {
    const doctor =
      cleanText(name) ||
      "Belirsiz";

    if (!map.has(doctor)) {
      map.set(
        doctor,
        {
          doctor,
          lead:
            0,
          quote:
            0,
          quoteAmount:
            0,
          salesCount:
            0,
          salesAmount:
            0
        }
      );
    }

    return map.get(doctor);
  }

  for (const row of leadRows) {
    getDoctor(row.doctor).lead +=
      1;
  }

  for (const row of quoteRows) {
    const item =
      getDoctor(row.doctor);

    item.quote +=
      1;

    item.quoteAmount +=
      Number(
        row.amountUsd || 0
      );
  }

  for (const row of wonRows) {
    const item =
      getDoctor(row.doctor);

    item.salesCount +=
      1;

    item.salesAmount +=
      Number(
        row.amountUsd || 0
      );
  }

  const rows =
    [...map.values()];

  const totalSales =
    sumBy(
      rows,
      (
        row
      ) => row.salesAmount
    );

  for (const row of rows) {
    row.quoteToSale =
      ratio(
        row.salesCount,
        row.quote
      );

    row.leadToSale =
      ratio(
        row.salesCount,
        row.lead
      );

    row.salesShare =
      ratio(
        row.salesAmount,
        totalSales
      );
  }

  rows.sort(
    (
      a,
      b
    ) =>
      b.salesAmount -
        a.salesAmount ||
      b.quoteAmount -
        a.quoteAmount ||
      b.salesCount -
        a.salesCount
  );

  return {
    period:
      filters.period,

    rows,

    totals: {
      lead:
        sumBy(
          rows,
          row => row.lead
        ),
      quote:
        sumBy(
          rows,
          row => row.quote
        ),
      quoteAmount:
        sumBy(
          rows,
          row => row.quoteAmount
        ),
      salesCount:
        sumBy(
          rows,
          row => row.salesCount
        ),
      salesAmount:
        totalSales
    }
  };
}

function buildLeadDistribution(
  data,
  filters,
  user
) {
  const sellers =
    visibleSellers(
      filters,
      user
    );

  if (
    filters.period ===
    "genel"
  ) {
    const general =
      Array(12)
        .fill(0);

    const sellerMap =
      new Map(
        sellers.map(
          (
            seller
          ) => [
            seller.key,
            {
              seller:
                seller.key,

              sellerLabel:
                seller.label,

              values:
                Array(12)
                  .fill(0)
            }
          ]
        )
      );

    for (
      const row of
      data.leadRows
    ) {
      if (
        !matchesDimensions(
          row,
          filters,
          user
        )
      ) {
        continue;
      }

      if (
        row.newLeadYear !==
          YEAR ||
        row.newLeadMonth <
          1 ||
        row.newLeadMonth >
          12
      ) {
        continue;
      }

      const index =
        row.newLeadMonth -
        1;

      general[index] +=
        1;

      const seller =
        sellerMap.get(
          row.seller
        );

      if (seller) {
        seller.values[
          index
        ] +=
          1;
      }
    }

    return {
      mode:
        "monthly",

      source:
        "YD New Lead - Arrived Time",

      labels:
        MONTH_NAMES.map(
          (
            name
          ) =>
            name.slice(
              0,
              3
            )
        ),

      general,

      sellers: [
        ...sellerMap.values()
      ]
    };
  }

  const month =
    Number(
      filters.period
    );

  const days =
    daysInMonth(
      YEAR,
      month
    );

  const general =
    Array(days)
      .fill(0);

  const sellerMap =
    new Map(
      sellers.map(
        (
          seller
        ) => [
          seller.key,
          {
            seller:
              seller.key,

            sellerLabel:
              seller.label,

            values:
              Array(days)
                .fill(0)
          }
        ]
      )
    );

  for (
    const row of
    data.leadRows
  ) {
    if (
      !matchesDimensions(
        row,
        filters,
        user
      )
    ) {
      continue;
    }

    if (
      row.newLeadYear !==
        YEAR ||
      row.newLeadMonth !==
        month ||
      row.newLeadDay <
        1 ||
      row.newLeadDay >
        days
    ) {
      continue;
    }

    const index =
      row.newLeadDay -
      1;

    general[index] +=
      1;

    const seller =
      sellerMap.get(
        row.seller
      );

    if (seller) {
      seller.values[
        index
      ] +=
        1;
    }
  }

  return {
    mode:
      "daily",

    source:
      "YD New Lead - Arrived Time",

    month,

    monthName:
      MONTH_NAMES[
        month - 1
      ],

    labels:
      Array.from(
        {
          length:
            days
        },
        (
          _,
          index
        ) =>
          String(
            index + 1
          )
      ),

    general,

    sellers: [
      ...sellerMap.values()
    ]
  };
}

/* =========================================================
   LEAD -> QUOTED
========================================================= */

function percentile(
  values,
  p
) {
  if (
    !values.length
  ) {
    return 0;
  }

  const sorted = [
    ...values
  ].sort(
    (
      a,
      b
    ) =>
      a - b
  );

  if (
    sorted.length ===
    1
  ) {
    return sorted[0];
  }

  const index =
    (
      sorted.length -
      1
    ) *
    p;

  const lower =
    Math.floor(index);

  const upper =
    Math.ceil(index);

  if (
    lower === upper
  ) {
    return sorted[
      lower
    ];
  }

  const weight =
    index -
    lower;

  return (
    sorted[lower] *
      (
        1 -
        weight
      ) +
    sorted[upper] *
      weight
  );
}

function durationStats(
  records
) {
  const values =
    records
      .map(
        (
          row
        ) =>
          Number(
            row.durationMinutes
          )
      )
      .filter(
        (
          value
        ) =>
          Number.isFinite(
            value
          ) &&
          value >= 0
      );

  if (
    !values.length
  ) {
    return {
      count: 0,

      avgMinutes: 0,

      medianMinutes: 0,

      p75Minutes: 0,

      p90Minutes: 0,

      p95Minutes: 0,

      fastestMinutes: 0,

      slowestMinutes: 0,

      under1hPct: 0,

      under4hPct: 0,

      under12hPct: 0,

      under24hPct: 0,

      over24hPct: 0,

      over3dPct: 0,

      over7dPct: 0,

      outlierThresholdMinutes:
        0,

      outlierCount: 0,

      outlierPct: 0,

      buckets: {
        under1h: 0,
        h1to4: 0,
        h4to12: 0,
        h12to24: 0,
        d1to3: 0,
        d3to7: 0,
        over7d: 0
      }
    };
  }

  const avg =
    values.reduce(
      (
        a,
        b
      ) =>
        a + b,
      0
    ) /
    values.length;

  const q1 =
    percentile(
      values,
      0.25
    );

  const q3 =
    percentile(
      values,
      0.75
    );

  const threshold =
    Math.max(
      q3 +
        1.5 *
        Math.max(
          q3 -
            q1,
          0
        ),
      1440
    );

  const buckets = {
    under1h: 0,
    h1to4: 0,
    h4to12: 0,
    h12to24: 0,
    d1to3: 0,
    d3to7: 0,
    over7d: 0
  };

  let outliers = 0;

  for (
    const minutes of
    values
  ) {
    if (
      minutes < 60
    ) {
      buckets.under1h +=
        1;

    } else if (
      minutes < 240
    ) {
      buckets.h1to4 +=
        1;

    } else if (
      minutes < 720
    ) {
      buckets.h4to12 +=
        1;

    } else if (
      minutes < 1440
    ) {
      buckets.h12to24 +=
        1;

    } else if (
      minutes < 4320
    ) {
      buckets.d1to3 +=
        1;

    } else if (
      minutes < 10080
    ) {
      buckets.d3to7 +=
        1;

    } else {
      buckets.over7d +=
        1;
    }

    if (
      minutes >
      threshold
    ) {
      outliers +=
        1;
    }
  }

  return {
    count:
      values.length,

    avgMinutes:
      avg,

    medianMinutes:
      percentile(
        values,
        0.5
      ),

    p75Minutes:
      percentile(
        values,
        0.75
      ),

    p90Minutes:
      percentile(
        values,
        0.9
      ),

    p95Minutes:
      percentile(
        values,
        0.95
      ),

    fastestMinutes:
      Math.min(
        ...values
      ),

    slowestMinutes:
      Math.max(
        ...values
      ),

    under1hPct:
      ratio(
        buckets.under1h,
        values.length
      ),

    under4hPct:
      ratio(
        buckets.under1h +
          buckets.h1to4,
        values.length
      ),

    under12hPct:
      ratio(
        buckets.under1h +
          buckets.h1to4 +
          buckets.h4to12,
        values.length
      ),

    under24hPct:
      ratio(
        buckets.under1h +
          buckets.h1to4 +
          buckets.h4to12 +
          buckets.h12to24,
        values.length
      ),

    over24hPct:
      ratio(
        buckets.d1to3 +
          buckets.d3to7 +
          buckets.over7d,
        values.length
      ),

    over3dPct:
      ratio(
        buckets.d3to7 +
          buckets.over7d,
        values.length
      ),

    over7dPct:
      ratio(
        buckets.over7d,
        values.length
      ),

    outlierThresholdMinutes:
      threshold,

    outlierCount:
      outliers,

    outlierPct:
      ratio(
        outliers,
        values.length
      ),

    buckets
  };
}

function longestCases(
  records,
  stats,
  limit = 10
) {
  const median =
    Number(
      stats.medianMinutes ||
      0
    );

  const threshold =
    Number(
      stats.outlierThresholdMinutes ||
      0
    );

  return [
    ...records
  ]
    .sort(
      (
        a,
        b
      ) =>
        b.durationMinutes -
        a.durationMinutes
    )
    .slice(
      0,
      limit
    )
    .map(
      (
        row,
        index
      ) => ({
        rank:
          index + 1,

        ...row,

        delayVsMedianMinutes:
          Math.max(
            row.durationMinutes -
              median,
            0
          ),

        multipleOfMedian:
          median > 0
            ? row.durationMinutes /
              median
            : 0,

        isOutlier:
          threshold > 0 &&
          row.durationMinutes >
            threshold
      })
    );
}

function buildLeadToQuoted(
  data,
  filters,
  user
) {
  const selectedMonth =
    filters.period ===
      "genel"
      ? null
      : Number(
          filters.period
        );

  const records = [];

  const quality = {
    leadRowsConsidered: 0,
    quotedRowsConsidered: 0,
    measured: 0,
    missingId: 0,
    leadNotFound: 0,
    missingStartDate: 0,
    missingNewLeadDate: 0,
    missingQuotedDate: 0,
    excludedDifferentMonth: 0,
    excludedDifferentYear: 0,
    negativeDuration: 0
  };

  for (
    const lead of
    data.quoteSpeedRows
  ) {
    if (
      !matchesDimensions(
        lead,
        filters,
        user
      )
    ) {
      continue;
    }

    quality.quotedRowsConsidered +=
      1;
    quality.leadRowsConsidered +=
      1;

    if (!lead.id) {
      quality.missingId +=
        1;
    }

    if (!lead.quotedDate) {
      quality.missingQuotedDate +=
        1;
      continue;
    }

    if (!lead.newLeadDate) {
      quality.missingStartDate +=
        1;
      quality.missingNewLeadDate +=
        1;
      continue;
    }

    if (
      lead.newLeadYear !==
        YEAR ||
      lead.quotedYear !==
        YEAR
    ) {
      quality.excludedDifferentYear +=
        1;
      continue;
    }

    if (
      lead.newLeadMonth !==
      lead.quotedMonth
    ) {
      quality.excludedDifferentMonth +=
        1;
      continue;
    }

    if (
      selectedMonth !==
        null &&
      (
        lead.newLeadMonth !==
          selectedMonth ||
        lead.quotedMonth !==
          selectedMonth
      )
    ) {
      continue;
    }

    const durationMinutes =
      (
        lead.quotedDate.getTime() -
        lead.newLeadDate.getTime()
      ) /
      60000;

    if (
      !Number.isFinite(
        durationMinutes
      ) ||
      durationMinutes < 0
    ) {
      quality.negativeDuration +=
        1;
      continue;
    }

    records.push({
      id:
        lead.id ||
        "",

      patientName:
        lead.patientName ||
        "",

      seller:
        lead.seller,

      sellerLabel:
        lead.sellerLabel ||
        sellerLabel(
          lead.seller
        ),

      department:
        lead.department ||
        "Belirsiz",

      doctor:
        lead.doctor ||
        "Belirsiz",

      amountUsd:
        0,

      newLeadAt:
        localIsoDateTime(
          lead.newLeadDate
        ),

      speedStartSource:
        "Ham Teklif: New Lead Arrived Time",

      quotedAt:
        localIsoDateTime(
          lead.quotedDate
        ),

      durationMinutes
    });
  }

  quality.measured =
    records.length;

  const generalStats =
    durationStats(
      records
    );

  const sellers =
    visibleSellers(
      filters,
      user
    ).map(
      (
        seller
      ) => {
        const sellerRows =
          records.filter(
            (
              row
            ) =>
              row.seller ===
              seller.key
          );

        const stats =
          durationStats(
            sellerRows
          );

        return {
          seller:
            seller.key,

          sellerLabel:
            seller.label,

          ...stats,

          longestCases:
            longestCases(
              sellerRows,
              stats,
              10
            )
        };
      }
    );

  function dimension(key) {
    const map =
      new Map();

    for (
      const row of
      records
    ) {
      const name =
        cleanText(
          row[key]
        ) ||
        "Belirsiz";

      if (
        !map.has(
          name
        )
      ) {
        map.set(
          name,
          []
        );
      }

      map
        .get(name)
        .push(row);
    }

    return [
      ...map.entries()
    ]
      .map(
        ([
          name,
          rows
        ]) => {
          const stats =
            durationStats(
              rows
            );

          return {
            name,
            ...stats,

            longestCases:
              longestCases(
                rows,
                stats,
                5
              )
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
            a.count ||
          b.medianMinutes -
            a.medianMinutes
      );
  }

  return {
    sameMonthOnly:
      true,

    period:
      filters.period,

    general: {
      ...generalStats,

      longestCases:
        longestCases(
          records,
          generalStats,
          15
        )
    },

    sellers,

    departments:
      dimension(
        "department"
      ),

    doctors:
      dimension(
        "doctor"
      ),

    quality
  };
}

/* =========================================================
   COORDINATOR ANALYSIS
========================================================= */

function isUnassignedSeller(
  value
) {
  const key =
    normalizeText(value);

  return (
    !key ||
    key === "atanmamis" ||
    key === "unassigned" ||
    key === "belirsiz"
  );
}

function topEntry(
  map,
  options = {}
) {
  const {
    ignoreUnassigned =
      false
  } =
    options;

  const rows =
    [
      ...map.entries()
    ]
      .filter(
        ([
          name
        ]) =>
          !(
            ignoreUnassigned &&
            isUnassignedSeller(
              name
            )
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b[1] -
            a[1] ||
          String(a[0])
            .localeCompare(
              String(b[0]),
              "tr"
            )
      );

  if (
    !rows.length
  ) {
    return {
      name:
        "-",

      count:
        0
    };
  }

  return {
    name:
      rows[0][0],

    count:
      rows[0][1]
  };
}

function buildCoordinatorAnalysisLegacy(
  data,
  query,
  user
) {
  let rows = [
    ...data.coordinatorRows
  ];

  /*
    Satıcı hesabıyla giriş yapılmışsa
    sadece kendi kartlarını görür.
  */
  if (
    user?.role ===
      "seller" &&
    user.seller
  ) {
    const ownSeller =
      userSellerKey(user);

    rows =
      rows.filter(
        (
          row
        ) =>
          row.seller ===
          ownSeller
      );
  }

  const filters = {
    period:
      String(
        query.period ||
        "genel"
      ),

    coordinator:
      cleanText(
        query.coordinator ||
        "Tümü"
      ),

    seller:
      cleanText(
        query.seller ||
        "Tümü"
      ),

    department:
      cleanText(
        query.department ||
        "Tümü"
      ),

    status:
      cleanText(
        query.status ||
        "Tümü"
      )
  };

  rows =
    rows.filter(
      (
        row
      ) => {
        if (
          filters.period !==
            "genel" &&
          (
            row.year !==
              YEAR ||
            row.month !==
              Number(
                filters.period
              )
          )
        ) {
          return false;
        }

        if (
          filters.coordinator !==
            "Tümü" &&
          row.coordinator !==
            filters.coordinator
        ) {
          return false;
        }

        if (
          filters.seller !==
            "Tümü" &&
          row.seller !==
            filters.seller
        ) {
          return false;
        }

        if (
          filters.department !==
            "Tümü" &&
          row.department !==
            filters.department
        ) {
          return false;
        }

        if (
          filters.status !==
            "Tümü" &&
          row.status !==
            filters.status
        ) {
          return false;
        }

        return true;
      }
    );

  const totalCards =
    rows.length;

  const salesCards =
    rows.filter(
      (
        row
      ) =>
        row.isSale
    ).length;

  const appointmentBooked =
    rows.filter(
      (
        row
      ) =>
        row.isQuoted
    ).length;

  const arrived =
    rows.filter(
      (
        row
      ) =>
        row.statusKey ===
        "arrived"
    ).length;

  const successful =
    rows.filter(
      (
        row
      ) =>
        row.statusKey ===
        "successful"
    ).length;

  const byCoordinator =
    new Map();

  const bySeller =
    new Map();

  const byDepartment =
    new Map();

  const coordinatorSeller =
    new Map();

  const coordinatorDepartment =
    new Map();

  const statusCounts =
    new Map();

  function ensureBucket(
    map,
    key,
    factory
  ) {
    if (
      !map.has(
        key
      )
    ) {
      map.set(
        key,
        factory()
      );
    }

    return map.get(
      key
    );
  }

  for (
    const row of
    rows
  ) {
    statusCounts.set(
      row.status,
      (
        statusCounts.get(
          row.status
        ) ||
        0
      ) +
      1
    );

    const coordinator =
      ensureBucket(
        byCoordinator,
        row.coordinator,
        () => ({
          coordinator:
            row.coordinator,

          cards:
            0,

          appointmentBooked:
            0,

          arrived:
            0,

          successful:
            0,

          salesCards:
            0,

          sellerCounts:
            new Map(),

          departmentCounts:
            new Map(),

          unassignedCards:
            0
        })
      );

    coordinator.cards +=
      1;

    if (
      row.isQuoted
    ) {
      coordinator.appointmentBooked +=
        1;
    }

    if (
      row.statusKey ===
      "arrived"
    ) {
      coordinator.arrived +=
        1;
    }

    if (
      row.statusKey ===
      "successful"
    ) {
      coordinator.successful +=
        1;
    }

    if (
      row.isSale
    ) {
      coordinator.salesCards +=
        1;
    }

    coordinator.sellerCounts.set(
      row.seller,
      (
        coordinator.sellerCounts.get(
          row.seller
        ) ||
        0
      ) +
      1
    );

    coordinator.departmentCounts.set(
      row.department,
      (
        coordinator.departmentCounts.get(
          row.department
        ) ||
        0
      ) +
      1
    );

    if (
      isUnassignedSeller(
        row.seller
      )
    ) {
      coordinator.unassignedCards +=
        1;
    }

    const seller =
      ensureBucket(
        bySeller,
        row.seller,
        () => ({
          seller:
            row.seller,

          sellerLabel:
            row.sellerLabel,

          cards:
            0,

          salesCards:
            0,

          coordinatorCounts:
            new Map()
        })
      );

    seller.cards +=
      1;

    if (
      row.isSale
    ) {
      seller.salesCards +=
        1;
    }

    seller.coordinatorCounts.set(
      row.coordinator,
      (
        seller.coordinatorCounts.get(
          row.coordinator
        ) ||
        0
      ) +
      1
    );

    const department =
      ensureBucket(
        byDepartment,
        row.department,
        () => ({
          department:
            row.department,

          cards:
            0,

          salesCards:
            0,

          coordinatorCounts:
            new Map()
        })
      );

    department.cards +=
      1;

    if (
      row.isSale
    ) {
      department.salesCards +=
        1;
    }

    department.coordinatorCounts.set(
      row.coordinator,
      (
        department.coordinatorCounts.get(
          row.coordinator
        ) ||
        0
      ) +
      1
    );

    const coordinatorSellerKey =
      `${row.coordinator}\u0000${row.seller}`;

    const sellerCross =
      ensureBucket(
        coordinatorSeller,
        coordinatorSellerKey,
        () => ({
          coordinator:
            row.coordinator,

          seller:
            row.seller,

          sellerLabel:
            row.sellerLabel,

          cards:
            0,

          salesCards:
            0,

          appointmentBooked:
            0,

          arrived:
            0,

          successful:
            0
        })
      );

    sellerCross.cards +=
      1;

    if (
      row.isSale
    ) {
      sellerCross.salesCards +=
        1;
    }

    if (
      row.isQuoted
    ) {
      sellerCross.appointmentBooked +=
        1;
    }

    if (
      row.statusKey ===
      "arrived"
    ) {
      sellerCross.arrived +=
        1;
    }

    if (
      row.statusKey ===
      "successful"
    ) {
      sellerCross.successful +=
        1;
    }

    const coordinatorDepartmentKey =
      `${row.coordinator}\u0000${row.department}`;

    const departmentCross =
      ensureBucket(
        coordinatorDepartment,
        coordinatorDepartmentKey,
        () => ({
          coordinator:
            row.coordinator,

          department:
            row.department,

          cards:
            0,

          salesCards:
            0,

          appointmentBooked:
            0,

          arrived:
            0,

          successful:
            0
        })
      );

    departmentCross.cards +=
      1;

    if (
      row.isSale
    ) {
      departmentCross.salesCards +=
        1;
    }

    if (
      row.isQuoted
    ) {
      departmentCross.appointmentBooked +=
        1;
    }

    if (
      row.statusKey ===
      "arrived"
    ) {
      departmentCross.arrived +=
        1;
    }

    if (
      row.statusKey ===
      "successful"
    ) {
      departmentCross.successful +=
        1;
    }
  }

  const coordinators =
    [
      ...byCoordinator.values()
    ]
      .map(
        (
          coordinator
        ) => {
          const topSeller =
            topEntry(
              coordinator.sellerCounts,
              {
                ignoreUnassigned:
                  true
              }
            );

          const topDepartment =
            topEntry(
              coordinator.departmentCounts
            );

          return {
            coordinator:
              coordinator.coordinator,

            cards:
              coordinator.cards,

            appointmentBooked:
              coordinator.appointmentBooked,

            arrived:
              coordinator.arrived,

            successful:
              coordinator.successful,

            salesCards:
              coordinator.salesCards,

            conversionRate:
              ratio(
                coordinator.salesCards,
                coordinator.cards
              ),

            unassignedCards:
              coordinator.unassignedCards,

            topSeller:
              anySellerLabel(
                topSeller.name
              ),

            topSellerKey:
              topSeller.name,

            topSellerCards:
              topSeller.count,

            topDepartment:
              topDepartment.name,

            topDepartmentCards:
              topDepartment.count
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cards -
            a.cards ||
          b.salesCards -
            a.salesCards ||
          b.conversionRate -
            a.conversionRate
      );

  const coordinatorToSeller =
    [
      ...coordinatorSeller.values()
    ]
      .map(
        (
          row
        ) => ({
          ...row,

          conversionRate:
            ratio(
              row.salesCards,
              row.cards
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cards -
            a.cards ||
          b.salesCards -
            a.salesCards
      );

  const coordinatorToDepartment =
    [
      ...coordinatorDepartment.values()
    ]
      .map(
        (
          row
        ) => ({
          ...row,

          conversionRate:
            ratio(
              row.salesCards,
              row.cards
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cards -
            a.cards ||
          b.salesCards -
            a.salesCards
      );

  const sellerInbound =
    [
      ...bySeller.values()
    ]
      .map(
        (
          seller
        ) => {
          const topCoordinator =
            topEntry(
              seller.coordinatorCounts
            );

          return {
            seller:
              seller.seller,

            sellerLabel:
              seller.sellerLabel,

            cards:
              seller.cards,

            salesCards:
              seller.salesCards,

            conversionRate:
              ratio(
                seller.salesCards,
                seller.cards
              ),

            topCoordinator:
              topCoordinator.name,

            topCoordinatorCards:
              topCoordinator.count
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cards -
            a.cards ||
          b.salesCards -
            a.salesCards
      );

  const departmentInbound =
    [
      ...byDepartment.values()
    ]
      .map(
        (
          department
        ) => {
          const topCoordinator =
            topEntry(
              department.coordinatorCounts
            );

          return {
            department:
              department.department,

            cards:
              department.cards,

            salesCards:
              department.salesCards,

            conversionRate:
              ratio(
                department.salesCards,
                department.cards
              ),

            topCoordinator:
              topCoordinator.name,

            topCoordinatorCards:
              topCoordinator.count
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.cards -
            a.cards ||
          b.salesCards -
            a.salesCards
      );

  const statusBreakdown =
    [
      ...statusCounts.entries()
    ]
      .map(
        ([
          status,
          count
        ]) => ({
          status,

          count,

          share:
            ratio(
              count,
              totalCards
            )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      );

  const availableRows =
    user?.role ===
      "seller" &&
    user.seller
      ? data.coordinatorRows.filter(
          (
            row
          ) =>
            row.seller ===
            userSellerKey(
              user
            )
        )
      : data.coordinatorRows;

  return {
    filters,

    kpis: {
      totalCards,

      salesCards,

      conversionRate:
        ratio(
          salesCards,
          totalCards
        ),

      activeCoordinators:
        new Set(
          rows
            .map(
              (
                row
              ) =>
                row.coordinator
            )
            .filter(Boolean)
        ).size,

      appointmentBooked,

      arrived,

      successful,

      unassignedCards:
        rows.filter(
          (
            row
          ) =>
            isUnassignedSeller(
              row.seller
            )
        ).length
    },

    coordinators,

    coordinatorToSeller,

    coordinatorToDepartment,

    sellerInbound,

    departmentInbound,

    statusBreakdown,

    options: {
      coordinators:
        uniqueSorted(
          availableRows,
          "coordinator"
        ),

      sellers:
        [
          ...new Map(
            availableRows.map(
              (
                row
              ) => [
                row.seller,
                {
                  value:
                    row.seller,

                  label:
                    row.sellerLabel
                }
              ]
            )
          ).values()
        ].sort(
          (
            a,
            b
          ) =>
            a.label.localeCompare(
              b.label,
              "tr"
            )
        ),

      departments:
        uniqueSorted(
          availableRows,
          "department"
        ),

      statuses:
        uniqueSorted(
          availableRows,
          "status"
        )
    },

    dataQuality:
      data.dataQuality
        .coordinator,

    rule: {
      salesStatuses: [
        "Lead",
        "Teklif",
        "Satış"
      ],

      dedupe:
        "Bitrix ID bazında tekilleştirilir; aynı ID yalnızca bir kez sayılır.",

      period:
        "Ay seçimi Ham Lead sayfasındaki YD New Lead - Arrived Time; bu alan boşsa Başlangıç tarihi üzerinden yapılır."
    }
  };
}

/*
  Aracı ekranında her metrik kendi gerçek olay tarihine göre hesaplanır:
  - Lead: Ham Lead / New Lead (yoksa Başlangıç)
  - Teklif: Ham Teklif / Quoted Arrived Time
  - Satış: Ham Deal Won / Deal Won Arrived Time

  Böylece aynı ay filtresinde satış adedi ana Satış Dashboard'u ile aynıdır.
*/
function buildCoordinatorAnalysis(
  data,
  query,
  user
) {
  const filters = {
    period: String(query.period || "genel"),
    coordinator: cleanText(query.coordinator || "Tümü"),
    seller: cleanText(query.seller || "Tümü"),
    department: cleanText(query.department || "Tümü"),
    status: cleanText(query.status || "Tümü")
  };

  const ownSeller =
    user?.role === "seller" && user.seller
      ? userSellerKey(user)
      : "";

  function eventMatches(row, eventType) {
    if (!row.coordinator) {
      return false;
    }

    if (ownSeller && row.seller !== ownSeller) {
      return false;
    }

    if (
      filters.period !== "genel" &&
      (
        row.year !== YEAR ||
        row.month !== Number(filters.period)
      )
    ) {
      return false;
    }

    if (
      filters.coordinator !== "Tümü" &&
      row.coordinator !== filters.coordinator
    ) {
      return false;
    }

    if (
      filters.seller !== "Tümü" &&
      row.seller !== filters.seller
    ) {
      return false;
    }

    if (
      filters.department !== "Tümü" &&
      row.department !== filters.department
    ) {
      return false;
    }

    if (
      filters.status !== "Tümü" &&
      normalizeText(filters.status) !== eventType
    ) {
      return false;
    }

    return true;
  }

  const leadRows =
    data.leadRows.filter(row => eventMatches(row, "lead"));

  const quoteRows =
    data.quoteRows.filter(row => eventMatches(row, "teklif"));

  const wonRows =
    data.wonRows.filter(row => eventMatches(row, "satis"));

  const byCoordinator = new Map();
  const bySeller = new Map();
  const byDepartment = new Map();
  const coordinatorSeller = new Map();
  const coordinatorDepartment = new Map();

  function ensureBucket(map, key, factory) {
    if (!map.has(key)) {
      map.set(key, factory());
    }

    return map.get(key);
  }

  function addEvent(row, eventType) {
    const coordinator = ensureBucket(
      byCoordinator,
      row.coordinator,
      () => ({
        coordinator: row.coordinator,
        cards: 0,
        appointmentBooked: 0,
        arrived: 0,
        successful: 0,
        salesCards: 0,
        quoteAmount: 0,
        salesAmount: 0,
        sellerCounts: new Map(),
        departmentCounts: new Map(),
        unassignedCards: 0
      })
    );

    const seller = ensureBucket(
      bySeller,
      row.seller,
      () => ({
        seller: row.seller,
        sellerLabel: row.sellerLabel,
        cards: 0,
        quoteCount: 0,
        salesCards: 0,
        quoteAmount: 0,
        salesAmount: 0,
        coordinatorCounts: new Map()
      })
    );

    const department = ensureBucket(
      byDepartment,
      row.department || "Belirsiz",
      () => ({
        department: row.department || "Belirsiz",
        cards: 0,
        quoteCount: 0,
        salesCards: 0,
        quoteAmount: 0,
        salesAmount: 0,
        coordinatorCounts: new Map()
      })
    );

    const sellerCross = ensureBucket(
      coordinatorSeller,
      `${row.coordinator}\u0000${row.seller}`,
      () => ({
        coordinator: row.coordinator,
        seller: row.seller,
        sellerLabel: row.sellerLabel,
        cards: 0,
        salesCards: 0,
        appointmentBooked: 0,
        quoteAmount: 0,
        salesAmount: 0,
        arrived: 0,
        successful: 0
      })
    );

    const departmentName = row.department || "Belirsiz";
    const departmentCross = ensureBucket(
      coordinatorDepartment,
      `${row.coordinator}\u0000${departmentName}`,
      () => ({
        coordinator: row.coordinator,
        department: departmentName,
        cards: 0,
        salesCards: 0,
        appointmentBooked: 0,
        quoteAmount: 0,
        salesAmount: 0,
        arrived: 0,
        successful: 0
      })
    );

    if (eventType === "lead") {
      coordinator.cards += 1;
      seller.cards += 1;
      department.cards += 1;
      sellerCross.cards += 1;
      departmentCross.cards += 1;

      coordinator.sellerCounts.set(
        row.seller,
        (coordinator.sellerCounts.get(row.seller) || 0) + 1
      );

      coordinator.departmentCounts.set(
        departmentName,
        (coordinator.departmentCounts.get(departmentName) || 0) + 1
      );

      seller.coordinatorCounts.set(
        row.coordinator,
        (seller.coordinatorCounts.get(row.coordinator) || 0) + 1
      );

      department.coordinatorCounts.set(
        row.coordinator,
        (department.coordinatorCounts.get(row.coordinator) || 0) + 1
      );

      if (isUnassignedSeller(row.seller)) {
        coordinator.unassignedCards += 1;
      }

    } else if (eventType === "teklif") {
      const amount = Number(row.amountUsd || 0);

      coordinator.appointmentBooked += 1;
      coordinator.quoteAmount += amount;
      seller.quoteCount += 1;
      seller.quoteAmount += amount;
      department.quoteCount += 1;
      department.quoteAmount += amount;
      sellerCross.appointmentBooked += 1;
      sellerCross.quoteAmount += amount;
      departmentCross.appointmentBooked += 1;
      departmentCross.quoteAmount += amount;

    } else if (eventType === "satis") {
      const amount = Number(row.amountUsd || 0);

      coordinator.successful += 1;
      coordinator.salesCards += 1;
      coordinator.salesAmount += amount;
      seller.salesCards += 1;
      seller.salesAmount += amount;
      department.salesCards += 1;
      department.salesAmount += amount;
      sellerCross.successful += 1;
      sellerCross.salesCards += 1;
      sellerCross.salesAmount += amount;
      departmentCross.successful += 1;
      departmentCross.salesCards += 1;
      departmentCross.salesAmount += amount;
    }
  }

  leadRows.forEach(row => addEvent(row, "lead"));
  quoteRows.forEach(row => addEvent(row, "teklif"));
  wonRows.forEach(row => addEvent(row, "satis"));

  const coordinators = [...byCoordinator.values()]
    .map(coordinator => {
      const topSeller = topEntry(
        coordinator.sellerCounts,
        { ignoreUnassigned: true }
      );
      const topDepartment = topEntry(coordinator.departmentCounts);

      return {
        coordinator: coordinator.coordinator,
        cards: coordinator.cards,
        appointmentBooked: coordinator.appointmentBooked,
        arrived: coordinator.arrived,
        successful: coordinator.successful,
        salesCards: coordinator.salesCards,
        quoteAmount: coordinator.quoteAmount,
        salesAmount: coordinator.salesAmount,
        conversionRate: ratio(coordinator.salesCards, coordinator.cards),
        unassignedCards: coordinator.unassignedCards,
        topSeller: anySellerLabel(topSeller.name),
        topSellerKey: topSeller.name,
        topSellerCards: topSeller.count,
        topDepartment: topDepartment.name,
        topDepartmentCards: topDepartment.count
      };
    })
    .sort((a, b) =>
      b.cards - a.cards ||
      b.salesCards - a.salesCards ||
      b.conversionRate - a.conversionRate
    );

  const coordinatorToSeller = [...coordinatorSeller.values()]
    .map(row => ({
      ...row,
      conversionRate: ratio(row.salesCards, row.cards)
    }))
    .sort((a, b) => b.cards - a.cards || b.salesCards - a.salesCards);

  const coordinatorToDepartment = [...coordinatorDepartment.values()]
    .map(row => ({
      ...row,
      conversionRate: ratio(row.salesCards, row.cards)
    }))
    .sort((a, b) => b.cards - a.cards || b.salesCards - a.salesCards);

  const sellerInbound = [...bySeller.values()]
    .map(seller => {
      const topCoordinator = topEntry(seller.coordinatorCounts);

      return {
        seller: seller.seller,
        sellerLabel: seller.sellerLabel,
        cards: seller.cards,
        quoteCount: seller.quoteCount,
        salesCards: seller.salesCards,
        quoteAmount: seller.quoteAmount,
        salesAmount: seller.salesAmount,
        conversionRate: ratio(seller.salesCards, seller.cards),
        topCoordinator: topCoordinator.name,
        topCoordinatorCards: topCoordinator.count
      };
    })
    .sort((a, b) => b.cards - a.cards || b.salesCards - a.salesCards);

  const departmentInbound = [...byDepartment.values()]
    .map(department => {
      const topCoordinator = topEntry(department.coordinatorCounts);

      return {
        department: department.department,
        cards: department.cards,
        quoteCount: department.quoteCount,
        salesCards: department.salesCards,
        quoteAmount: department.quoteAmount,
        salesAmount: department.salesAmount,
        conversionRate: ratio(department.salesCards, department.cards),
        topCoordinator: topCoordinator.name,
        topCoordinatorCards: topCoordinator.count
      };
    })
    .sort((a, b) => b.cards - a.cards || b.salesCards - a.salesCards);

  const totalCards = leadRows.length;
  const appointmentBooked = quoteRows.length;
  const salesCards = wonRows.length;
  const totalQuoteAmount = sumBy(quoteRows, row => row.amountUsd);
  const totalSalesAmount = sumBy(wonRows, row => row.amountUsd);
  const allAvailableRows = [
    ...data.leadRows,
    ...data.quoteRows,
    ...data.wonRows
  ].filter(row => !ownSeller || row.seller === ownSeller);

  return {
    filters,
    kpis: {
      totalCards,
      salesCards,
      conversionRate: ratio(salesCards, totalCards),
      activeCoordinators: new Set(
        [...leadRows, ...quoteRows, ...wonRows]
          .map(row => row.coordinator)
          .filter(Boolean)
      ).size,
      appointmentBooked,
      totalQuoteAmount,
      totalSalesAmount,
      arrived: 0,
      successful: salesCards,
      unassignedCards: leadRows.filter(row => isUnassignedSeller(row.seller)).length
    },
    coordinators,
    coordinatorToSeller,
    coordinatorToDepartment,
    sellerInbound,
    departmentInbound,
    statusBreakdown: [
      { status: "Lead", count: totalCards, share: ratio(totalCards, totalCards) },
      { status: "Teklif", count: appointmentBooked, share: ratio(appointmentBooked, totalCards) },
      { status: "Satış", count: salesCards, share: ratio(salesCards, totalCards) }
    ],
    options: {
      coordinators: uniqueSorted(allAvailableRows, "coordinator"),
      sellers: [
        ...new Map(
          allAvailableRows
            .filter(row => row.seller)
            .map(row => [
              row.seller,
              { value: row.seller, label: row.sellerLabel || anySellerLabel(row.seller) }
            ])
        ).values()
      ].sort((a, b) => a.label.localeCompare(b.label, "tr")),
      departments: uniqueSorted(allAvailableRows, "department"),
      statuses: ["Lead", "Teklif", "Satış"]
    },
    dataQuality: data.dataQuality.coordinator,
    rule: {
      salesStatuses: ["Lead", "Teklif", "Satış"],
      dedupe: "Bitrix ID bazında tekilleştirilir; aynı ID her kaynakta yalnızca bir kez sayılır.",
      period: "Lead New Lead (yoksa Başlangıç), teklif Quoted ve satış Deal Won tarihine göre seçilen aya dahil edilir."
    }
  };
}

/* =========================================================
   CACHE CLEAR
========================================================= */

app.post(
  "/api/cache/clear",

  requireAuth,

  (
    req,
    res
  ) => {
    rawCache = null;
    rawCacheAt = 0;

    coreCache = null;
    coreCacheAt = 0;

    res.json({
      success:
        true
    });
  }
);

/* =========================================================
   XLSX REPORT HELPERS
========================================================= */

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelColumn(index) {
  let value = index + 1;
  let output = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }

  return output;
}

function excelCell(row, column, value, style = 0, numeric = false) {
  const reference = `${excelColumn(column)}${row}`;

  if (numeric) {
    const number = Number(value || 0);
    return `<c r="${reference}" s="${style}" t="n"><v>${Number.isFinite(number) ? number : 0}</v></c>`;
  }

  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

let crcTableCache = null;

function crc32(buffer) {
  if (!crcTableCache) {
    crcTableCache = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      return value >>> 0;
    });
  }

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTableCache[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateParts(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31),
    date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
  };
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  const stamp = zipDateParts();
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const checksum = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(stamp.time, 10);
    localHeader.writeUInt16LE(stamp.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(stamp.time, 12);
    centralHeader.writeUInt16LE(stamp.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, end]);
}

function buildOpenCasesXlsx(rows, metadata) {
  const headerRow = 14;
  const dataStartRow = headerRow + 1;
  const totalRow = dataStartRow + rows.length + 1;
  const total = sumBy(rows, row => Number(row.amountUsd || 0));
  const sheetRows = [];

  sheetRows.push(`<row r="1" ht="26" customHeight="1">${excelCell(1, 0, "RU ARACI TAKIMI BÜYÜK AÇIK VAKALAR RAPORU", 1)}</row>`);

  const meta = [
    ["Rapor Tarihi", metadata.reportDate],
    ["Dönem", metadata.period],
    ["Büyük Vaka Satıcısı", metadata.openCaseSeller],
    ["Minimum Teklif Tutarı", metadata.minimumAmount],
    ["Başlangıç Tarihi", metadata.startDate],
    ["Bitiş Tarihi", metadata.endDate],
    ["Ana Filtre - Satıcı", metadata.seller],
    ["Ana Filtre - Aracı", metadata.coordinator],
    ["Ana Filtre - Bölüm", metadata.department],
    ["Ana Filtre - Doktor", metadata.doctor],
    ["Ana Filtre - Kaynak", metadata.source]
  ];

  meta.forEach((item, index) => {
    const rowNumber = index + 2;
    sheetRows.push(`<row r="${rowNumber}">${excelCell(rowNumber, 0, item[0], 2)}${excelCell(rowNumber, 1, item[1], 0)}</row>`);
  });

  const headers = ["Sıra", "Bitrix ID", "Hasta Adı", "Satıcı", "Bölüm", "Doktor", "Aracı", "Kaynak", "Teklif Tarihi", "Teklif Tutarı (USD)"];
  sheetRows.push(`<row r="${headerRow}" ht="24" customHeight="1">${headers.map((header, index) => excelCell(headerRow, index, header, 3)).join("")}</row>`);

  rows.forEach((row, index) => {
    const rowNumber = dataStartRow + index;
    const values = [
      index + 1,
      row.id || "-",
      row.patientName || "İsimsiz vaka",
      row.sellerLabel || row.seller || "-",
      row.department || "-",
      row.doctor || "-",
      row.coordinator || "-",
      row.source || "-",
      row.quoteDate || "-"
    ];
    const cells = values.map((value, column) => excelCell(rowNumber, column, value, 5));
    cells.push(excelCell(rowNumber, 9, row.amountUsd, 4, true));
    sheetRows.push(`<row r="${rowNumber}">${cells.join("")}</row>`);
  });

  const totalCells = [excelCell(totalRow, 0, "TOPLAM", 6)];
  for (let column = 1; column < 8; column += 1) {
    totalCells.push(excelCell(totalRow, column, "", 6));
  }
  totalCells.push(excelCell(totalRow, 8, `${rows.length} dosya`, 6));
  totalCells.push(excelCell(totalRow, 9, total, 7, true));
  sheetRows.push(`<row r="${totalRow}">${totalCells.join("")}</row>`);

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J${totalRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="14" topLeftCell="A15" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/><col min="4" max="8" width="20" customWidth="1"/><col min="9" max="9" width="16" customWidth="1"/><col min="10" max="10" width="20" customWidth="1"/></cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A${headerRow}:J${Math.max(headerRow, dataStartRow + rows.length - 1)}"/><mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells></worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173957"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F70AD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF21865D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFDCE5EC"/></left><right style="thin"><color rgb="FFDCE5EC"/></right><top style="thin"><color rgb="FFDCE5EC"/></top><bottom style="thin"><color rgb="FFDCE5EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0"/><xf numFmtId="164" fontId="2" fillId="4" borderId="1" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Büyük Vakalar" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>RU Aracı Takımı Büyük Açık Vakalar Raporu</dc:title><dc:creator>RU Aracı Takımı Satış Dashboard’u</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const appProperties = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>RU Aracı Takımı Satış Dashboard’u</Application></Properties>`;

  return createStoredZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "docProps/core.xml", data: core },
    { name: "docProps/app.xml", data: appProperties },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/styles.xml", data: styles },
    { name: "xl/worksheets/sheet1.xml", data: sheet }
  ]);
}

/* =========================================================
   MAIN DASHBOARD API
========================================================= */

app.get(
  "/api/dashboard",

  requireAuth,

  async (
    req,
    res
  ) => {
    try {
      const rawPeriod =
        String(
          req.query.period ||
          "genel"
        );

      const period =
        rawPeriod ===
          "genel" ||
        (
          Number(
            rawPeriod
          ) >= 1 &&
          Number(
            rawPeriod
          ) <= 12
        )
          ? rawPeriod
          : "genel";

      const filters = {
        period,

        seller:
          req.query.seller ||
          "Tümü",

        coordinator:
          req.query.coordinator ||
          "Tümü",

        department:
          req.query.department ||
          "Tümü",

        doctor:
          req.query.doctor ||
          "Tümü",

        source:
          req.query.source ||
          "Tümü"
      };

      const data =
        await getCoreData();

      const result =
        aggregate(
          data,
          filters,
          req.session.user
        );

      return res.json({
        year:
          YEAR,

        filters,

        options:
          data.options,

        ...result,

        monthlySummary:
          buildMonthlySummary(
            data,
            filters,
            req.session.user
          ),

        openCases:
          buildOpenCases(
            data,
            filters,
            req.session.user
          ),

        departmentSales:
          buildDepartmentSales(
            data,
            filters,
            req.session.user
          ),

        doctorSales:
          buildDoctorSales(
            data,
            filters,
            req.session.user
          ),

        leadDistribution:
          buildLeadDistribution(
            data,
            filters,
            req.session.user
          ),

        leadToQuoted:
          buildLeadToQuoted(
            data,
            filters,
            req.session.user
          ),

        dataQuality:
          data.dataQuality,

        updatedAt:
          new Date()
            .toISOString()
      });

    } catch (
      error
    ) {
      console.error(
        "Dashboard error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);

app.get(
  "/api/reports/open-cases.xlsx",

  requireAuth,

  async (
    req,
    res
  ) => {
    try {
      const rawPeriod =
        String(
          req.query.period ||
          "genel"
        );

      const period =
        rawPeriod === "genel" ||
        (
          Number(rawPeriod) >= 1 &&
          Number(rawPeriod) <= 12
        )
          ? rawPeriod
          : "genel";

      const filters = {
        period,
        seller:
          req.query.seller ||
          "Tümü",
        coordinator:
          req.query.coordinator ||
          "Tümü",
        department:
          req.query.department ||
          "Tümü",
        doctor:
          req.query.doctor ||
          "Tümü",
        source:
          req.query.source ||
          "Tümü"
      };

      const openCaseSeller =
        cleanText(
          req.query.openCaseSeller ||
          "genel"
        );

      const minimumAmount =
        Math.max(
          0,
          Number(
            req.query.openCaseMin ||
            0
          ) || 0
        );

      const validDate =
        value =>
          /^\d{4}-\d{2}-\d{2}$/.test(
            String(value || "")
          )
            ? String(value)
            : "";

      let startDate =
        validDate(
          req.query.startDate
        );

      let endDate =
        validDate(
          req.query.endDate
        );

      if (
        startDate &&
        endDate &&
        startDate > endDate
      ) {
        [startDate, endDate] =
          [endDate, startDate];
      }

      const data =
        await getCoreData();

      const openCases =
        buildOpenCases(
          data,
          filters,
          req.session.user
        );

      const rows =
        openCases.rows
          .filter(
            row =>
              openCaseSeller === "genel" ||
              row.seller === openCaseSeller
          )
          .filter(
            row =>
              Number(row.amountUsd || 0) >=
              minimumAmount
          )
          .filter(
            row =>
              !startDate ||
              String(row.quoteDate || "") >=
                startDate
          )
          .filter(
            row =>
              !endDate ||
              String(row.quoteDate || "") <=
                endDate
          )
          .sort(
            (
              a,
              b
            ) =>
              Number(b.amountUsd || 0) -
              Number(a.amountUsd || 0)
          )
          .slice(0, 10);

      const selectedSeller =
        openCaseSeller === "genel"
          ? "Genel"
          : (
              openCases.rows.find(
                row =>
                  row.seller ===
                  openCaseSeller
              )?.sellerLabel ||
              openCaseSeller
            );

      const periodLabel =
        period === "genel"
          ? `${YEAR} Genel`
          : `${MONTH_NAMES[Number(period) - 1] || "Seçili Ay"} ${YEAR}`;

      const workbook =
        buildOpenCasesXlsx(
          rows,
          {
            reportDate:
              new Date().toLocaleString(
                "tr-TR",
                {
                  timeZone:
                    TIMEZONE
                }
              ),
            period:
              periodLabel,
            openCaseSeller:
              selectedSeller,
            minimumAmount:
              minimumAmount
                ? `${minimumAmount} USD`
                : "Tümü",
            startDate:
              startDate ||
              "Tümü",
            endDate:
              endDate ||
              "Tümü",
            seller:
              filters.seller,
            coordinator:
              filters.coordinator,
            department:
              filters.department,
            doctor:
              filters.doctor,
            source:
              filters.source
          }
        );

      const fileDate =
        startDate ||
        endDate ||
        new Date()
          .toISOString()
          .slice(0, 10);

      const filename =
        `RU_Araci_Takimi_Filtreli_Buyuk_Vakalar_${fileDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        "Content-Length",
        workbook.length
      );

      return res.send(workbook);
    } catch (
      error
    ) {
      console.error(
        "Open cases XLSX report error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);

/* =========================================================
   COORDINATOR API
========================================================= */

app.get(
  "/api/coordinator",

  requireAuth,

  async (
    req,
    res
  ) => {
    try {
      const data =
        await getCoreData();

      const analysis =
        buildCoordinatorAnalysis(
          data,
          req.query || {},
          req.session.user
        );

      return res.json({
        success:
          true,

        ...analysis,

        updatedAt:
          new Date()
            .toISOString()
      });

    } catch (
      error
    ) {
      console.error(
        "Aracı Dashboard hatası:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",

  (
    req,
    res
  ) => {
    res.json({
      ok:
        true,

      service:
        "ru-araci-takimi-dashboard",

      year:
        YEAR,

      expectedRule:
        "Deal Won monthly run-rate projection",

      coordinatorRule:
        "Source HBYS aracı alanı; Bitrix ID bazında Lead → Teklif → Satış",

      coordinatorEndpoint:
        "/api/coordinator",

      leadToQuotedRule:
        "Ham Teklif: aynı ay içindeki New Lead Arrived Time → Quoted Arrived Time"
    });
  }
);

/* =========================================================
   HOME
========================================================= */

app.get(
  "/",

  (
    req,
    res
  ) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",

  () => {
    console.log(
      `RU Aracı Takımı Satış Dashboard’u çalışıyor - Port ${PORT}`
    );

    console.log(
      "Aracı Dashboard aktif: /api/coordinator"
    );

    /* İlk kullanıcıyı bekletmemek için veriyi sunucu açılışında hazırla. */
    startCoreRefresh()
      .then(
        () => {
          console.log(
            "Dashboard önbelleği hazır."
          );
        }
      )
      .catch(
        error => {
          console.error(
            "Dashboard önbelleği başlangıçta hazırlanamadı:",
            error.message
          );
        }
      );
  }
);
