const PRELOAD_ASSETS = [
  "data/cn.png",
  "data/en.png",
  "data/adverb.png",
  "data/synonym.png",
  "data/sentence.png",
  "data/translate.png",
  "data/icon.png",
  "data/home.svg",
  "data/menu.svg",
  "data/setting.svg",
  "data/undo.svg",
  "data/volume.svg",
  "data/CN.csv",
  "data/EN.csv",
  "data/ADVERB.csv",
  "data/SYNONYM.csv",
  "data/SYNONYM_EN.csv",
  "data/SENTENCE.csv",
  "data/TRANSLATE.csv",
];

export function preloadChineseQuizAssets(onProgress) {
  let completed = 0;

  function reportProgress() {
    completed += 1;
    onProgress(Math.round((completed / PRELOAD_ASSETS.length) * 100));
  }

  return Promise.allSettled(PRELOAD_ASSETS.map((assetPath) => preloadAsset(assetPath).finally(reportProgress)));
}

function preloadAsset(assetPath) {
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(assetPath)) {
    return preloadImage(assetPath);
  }

  return fetch(assetPath, { cache: "force-cache" }).then((response) => {
    if (!response.ok) {
      throw new Error(`Could not preload ${assetPath}`);
    }
  });
}

function preloadImage(assetPath) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = () => reject(new Error(`Could not preload ${assetPath}`));
    image.src = assetPath;
  });
}
