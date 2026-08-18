import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { I18n, type TranslateOptions } from "i18n-js";
import { fr } from "./fr";
import { en } from "./en";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

const STORAGE_KEY = "frontiride.locale";

const i18n = new I18n({ fr, en });
i18n.enableFallback = true;
i18n.defaultLocale = "fr";

/** Langue du téléphone si on la gère, français sinon. */
function deviceLocale(): Locale {
  const tag = Localization.getLocales()[0]?.languageCode ?? "fr";
  return (LOCALES as readonly string[]).includes(tag) ? (tag as Locale) : "fr";
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, options?: TranslateOptions) => string;
  /** Formate un montant en francs CFA selon la langue active. */
  formatAmount: (amountFcfa: number) => string;
  formatDate: (date: string | Date, withTime?: boolean) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && (LOCALES as readonly string[]).includes(saved)) {
          setLocaleState(saved as Locale);
        }
      })
      .catch(() => {
        // Un stockage indisponible ne doit pas empêcher l'app de démarrer :
        // on reste simplement sur la langue du téléphone.
      });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(() => {
    i18n.locale = locale;
    const tag = locale === "fr" ? "fr-FR" : "en-GB";

    return {
      locale,
      setLocale,
      t: (key, options) => i18n.t(key, options),
      formatAmount: (amountFcfa) =>
        `${new Intl.NumberFormat(tag).format(amountFcfa)} FCFA`,
      formatDate: (date, withTime = false) => {
        const value = typeof date === "string" ? new Date(date) : date;
        return new Intl.DateTimeFormat(tag, {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(value);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n doit être utilisé à l'intérieur de <I18nProvider>");
  }
  return value;
}
