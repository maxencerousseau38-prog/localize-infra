export type LocaleFormat = 'json' | 'po';

export interface JsonSource {
  project: string;
  license: string;
  repoUrl: string;
  commit: string;
  format: 'json';
  sourceFilePath: string;
  localeFilePath: (locale: string) => string;
  locales: Partial<Record<'de' | 'ja' | 'es' | 'ar' | 'pt-BR', string>>;
}

export interface PoSource {
  project: string;
  license: string;
  repoUrl: string;
  commit: string;
  format: 'po';
  sourceFilePath: (locale: string) => string;
  localeFilePath: (locale: string) => string;
  locales: Partial<Record<'de' | 'ja' | 'es' | 'ar' | 'pt-BR', string>>;
}

export type CorpusSource = JsonSource | PoSource;

export const CORPUS_SOURCES: CorpusSource[] = [
  {
    project: 'excalidraw',
    license: 'MIT',
    repoUrl: 'https://github.com/excalidraw/excalidraw',
    commit: '786ab266ff3a9cfffaed16804cf9132b44bc08ae',
    format: 'json',
    sourceFilePath: 'packages/excalidraw/locales/en.json',
    localeFilePath: (fileLocale) =>
      `packages/excalidraw/locales/${fileLocale}.json`,
    locales: {
      de: 'de-DE',
      ja: 'ja-JP',
      es: 'es-ES',
      ar: 'ar-SA',
      'pt-BR': 'pt-BR',
    },
  },
  {
    project: 'gitea',
    license: 'MIT',
    repoUrl: 'https://github.com/go-gitea/gitea',
    commit: 'a30d865b781b4611826bf44d60e44d9f6e8fdf4e',
    format: 'json',
    sourceFilePath: 'options/locale/locale_en-US.json',
    localeFilePath: (fileLocale) => `options/locale/locale_${fileLocale}.json`,
    locales: { de: 'de-DE', ja: 'ja-JP', es: 'es-ES', 'pt-BR': 'pt-BR' },
  },
  {
    project: 'zulip',
    license: 'Apache-2.0',
    repoUrl: 'https://github.com/zulip/zulip',
    commit: '83cdbfd28c14bb950d67e578893a062add8af633',
    format: 'po',
    sourceFilePath: (fileLocale) =>
      `locale/${fileLocale}/LC_MESSAGES/django.po`,
    localeFilePath: (fileLocale) =>
      `locale/${fileLocale}/LC_MESSAGES/django.po`,
    locales: { de: 'de', ja: 'ja', es: 'es', ar: 'ar' },
  },
  {
    project: 'syncthing',
    license: 'MPL-2.0',
    repoUrl: 'https://github.com/syncthing/syncthing',
    commit: 'bcef5c5bc68dddfb68a3d341f41fad44c11fb52e',
    format: 'json',
    sourceFilePath: 'gui/default/assets/lang/lang-en.json',
    localeFilePath: (fileLocale) =>
      `gui/default/assets/lang/lang-${fileLocale}.json`,
    locales: { de: 'de', ja: 'ja', es: 'es', ar: 'ar', 'pt-BR': 'pt-BR' },
  },
  {
    project: 'wekan',
    license: 'MIT',
    repoUrl: 'https://github.com/wekan/wekan',
    commit: '7def748adce331c66be5d3c15d6558cfacf3177c',
    format: 'json',
    sourceFilePath: 'imports/i18n/data/en.i18n.json',
    localeFilePath: (fileLocale) => `imports/i18n/data/${fileLocale}.i18n.json`,
    locales: { de: 'de', ja: 'ja', es: 'es', ar: 'ar', 'pt-BR': 'pt-BR' },
  },
];
