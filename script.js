const state = {
  originalImage: null,
  originalName: "",
  referenceImage: null,
  referenceName: "",
  targetLogoImage: null,
  defaultLogoDataUrl: "",
  logoImage: null,
  logoName: "",
  weight: "10斤",
  brand: "邻家饭香",
  marketing: "黑土种植\n一年一季\n鸭稻共生",
  generated: false,
  lastSize: null,
  pendingDownloadUrl: "",
  pendingDownloadFilename: "",
};

const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d");
const originalFileInput = document.querySelector("#originalFileInput");
const referenceFileInput = document.querySelector("#referenceFileInput");
const logoFileInput = document.querySelector("#logoFileInput");
const originalUploadButton = document.querySelector("#originalUploadButton");
const referenceUploadButton = document.querySelector("#referenceUploadButton");
const logoUploadButton = document.querySelector("#logoUploadButton");
const downloadButton = document.querySelector("#downloadButton");
const focusPromptButton = document.querySelector("#focusPromptButton");
const metadataDialog = document.querySelector("#metadataDialog");
const downloadDialog = document.querySelector("#downloadDialog");
const metadataForm = document.querySelector("#metadataForm");
const downloadForm = document.querySelector("#downloadForm");
const promptInput = document.querySelector("#promptInput");
const emptyPreview = document.querySelector("#emptyPreview");
const statusText = document.querySelector("#statusText");
const downloadFallbackLink = document.querySelector("#downloadFallbackLink");
const pageDownloadLink = document.querySelector("#pageDownloadLink");

const fieldNodes = {
  originalName: document.querySelector("#originalName"),
  referenceName: document.querySelector("#referenceName"),
  originalThumb: document.querySelector("#originalThumb"),
  referenceThumb: document.querySelector("#referenceThumb"),
  originalState: document.querySelector("#originalState"),
  referenceState: document.querySelector("#referenceState"),
  logoName: document.querySelector("#logoName"),
  logoState: document.querySelector("#logoState"),
  logoThumb: document.querySelector("#logoThumb"),
  modalLogoName: document.querySelector("#modalLogoName"),
  weightInput: document.querySelector("#weightInput"),
  brandInput: document.querySelector("#brandInput"),
  marketingInput: document.querySelector("#marketingInput"),
  weightSummary: document.querySelector("#weightSummary"),
  brandSummary: document.querySelector("#brandSummary"),
  copySummary: document.querySelector("#copySummary"),
  generatedSummary: document.querySelector("#generatedSummary"),
};

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("图片加载失败"));
      image.onload = () => resolve({ image, dataUrl: reader.result });
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  dialog.close ? dialog.close() : dialog.removeAttribute("open");
}

function markDirty(message) {
  state.generated = false;
  state.lastSize = null;
  statusText.textContent = message;
  refreshSummary();
}

function fitImage(ctxToUse, image, x, y, width, height, mode = "contain") {
  const ratio = mode === "cover"
    ? Math.max(width / image.width, height / image.height)
    : Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * ratio;
  const drawHeight = image.height * ratio;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctxToUse.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function loadBuiltInTargetLogo() {
  const image = new Image();
  image.onload = () => {
    state.targetLogoImage = image;
    prepareDefaultLogoPreview();
    refreshPreview();
  };
  image.src = encodeURI("./凤凰来仪-目标.jpg");
}

function prepareDefaultLogoPreview() {
  if (!state.targetLogoImage || state.logoImage) return;

  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = 96;
  logoCanvas.height = 96;
  const logoCtx = logoCanvas.getContext("2d");
  logoCtx.save();
  logoCtx.beginPath();
  logoCtx.arc(48, 48, 48, 0, Math.PI * 2);
  logoCtx.clip();
  logoCtx.fillStyle = "#ffffff";
  logoCtx.fillRect(0, 0, 96, 96);
  logoCtx.drawImage(state.targetLogoImage, 28, 34, 62, 62, 0, 0, 96, 96);
  logoCtx.restore();

  state.defaultLogoDataUrl = logoCanvas.toDataURL("image/png");
  fieldNodes.logoName.textContent = "默认商家 logo";
  fieldNodes.modalLogoName.textContent = "默认商家 logo";
  fieldNodes.logoThumb.src = state.defaultLogoDataUrl;
}

function drawRoundRect(ctxToUse, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctxToUse.beginPath();
  ctxToUse.moveTo(x + r, y);
  ctxToUse.arcTo(x + width, y, x + width, y + height, r);
  ctxToUse.arcTo(x + width, y + height, x, y + height, r);
  ctxToUse.arcTo(x, y + height, x, y, r);
  ctxToUse.arcTo(x, y, x + width, y, r);
  ctxToUse.closePath();
}

function drawWrappedText(ctxToUse, text, x, y, maxWidth, lineHeight, maxLines) {
  const source = String(text || "").replace(/\r/g, "").split("\n");
  const lines = [];
  source.forEach((part) => {
    let line = "";
    Array.from(part).forEach((char) => {
      const trial = line + char;
      if (ctxToUse.measureText(trial).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = trial;
      }
    });
    if (line) lines.push(line);
  });

  lines.slice(0, maxLines).forEach((line, index) => {
    ctxToUse.fillText(line, x, y + index * lineHeight);
  });
}

function drawMerchantLogo(ctxToUse) {
  const x = 34;
  const y = 50;
  const size = 48;

  ctxToUse.save();
  ctxToUse.beginPath();
  ctxToUse.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctxToUse.clip();
  ctxToUse.fillStyle = "#ffffff";
  ctxToUse.fillRect(x, y, size, size);

  if (state.logoImage) {
    fitImage(ctxToUse, state.logoImage, x, y, size, size, "cover");
  } else if (state.targetLogoImage) {
    ctxToUse.drawImage(state.targetLogoImage, 28, 34, 62, 62, x, y, size, size);
  } else {
    ctxToUse.fillStyle = "#f6d17a";
    ctxToUse.beginPath();
    ctxToUse.arc(x + 24, y + 20, 22, 0, Math.PI * 2);
    ctxToUse.fill();
    ctxToUse.fillStyle = "#8d4c2f";
    ctxToUse.beginPath();
    ctxToUse.arc(x + 24, y + 27, 15, 0, Math.PI * 2);
    ctxToUse.fill();
    ctxToUse.fillStyle = "#ffffff";
    ctxToUse.beginPath();
    ctxToUse.arc(x + 18, y + 24, 3, 0, Math.PI * 2);
    ctxToUse.arc(x + 29, y + 24, 3, 0, Math.PI * 2);
    ctxToUse.fill();
  }
  ctxToUse.restore();

  ctxToUse.strokeStyle = "#ffffff";
  ctxToUse.lineWidth = 4;
  ctxToUse.beginPath();
  ctxToUse.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
  ctxToUse.stroke();
}

function drawBottomRibbon(ctxToUse) {
  const weightMain = (state.weight || "10斤").replace(/\s/g, "");
  const numberPart = weightMain.match(/\d+/)?.[0] || weightMain;
  const unitPart = weightMain.replace(numberPart, "") || "斤";
  const left = 14;
  const right = 656;
  const top = 568;
  const bottom = 652;
  const radius = 24;

  ctxToUse.save();

  ctxToUse.beginPath();
  ctxToUse.moveTo(left, top);
  ctxToUse.lineTo(right, top);
  ctxToUse.lineTo(right, bottom - radius);
  ctxToUse.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctxToUse.lineTo(left + radius, bottom);
  ctxToUse.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctxToUse.lineTo(left, top);
  ctxToUse.closePath();
  ctxToUse.clip();

  const greenGradient = ctxToUse.createLinearGradient(176, top, right, bottom);
  greenGradient.addColorStop(0, "#6ecb39");
  greenGradient.addColorStop(0.38, "#37a91f");
  greenGradient.addColorStop(1, "#188917");
  ctxToUse.fillStyle = greenGradient;
  ctxToUse.fillRect(176, top + 18, right - 176, bottom - top - 18);

  const greenGloss = ctxToUse.createLinearGradient(176, top + 18, 176, bottom);
  greenGloss.addColorStop(0, "rgba(255, 255, 255, 0.28)");
  greenGloss.addColorStop(0.36, "rgba(255, 255, 255, 0.05)");
  greenGloss.addColorStop(1, "rgba(0, 73, 18, 0.12)");
  ctxToUse.fillStyle = greenGloss;
  ctxToUse.fillRect(176, top + 18, right - 176, bottom - top - 18);

  const goldGradient = ctxToUse.createLinearGradient(left, top, 266, bottom);
  goldGradient.addColorStop(0, "#ffe08a");
  goldGradient.addColorStop(0.45, "#f6c557");
  goldGradient.addColorStop(1, "#eaa23a");
  ctxToUse.fillStyle = goldGradient;
  ctxToUse.save();
  ctxToUse.beginPath();
  ctxToUse.moveTo(left, top);
  ctxToUse.lineTo(168, top);
  ctxToUse.bezierCurveTo(216, top, 230, 602, 260, bottom);
  ctxToUse.lineTo(left + radius, bottom);
  ctxToUse.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctxToUse.lineTo(left, top);
  ctxToUse.closePath();
  ctxToUse.fill();

  ctxToUse.beginPath();
  ctxToUse.moveTo(left, top);
  ctxToUse.lineTo(168, top);
  ctxToUse.bezierCurveTo(216, top, 230, 602, 260, bottom);
  ctxToUse.lineTo(left + radius, bottom);
  ctxToUse.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctxToUse.lineTo(left, top);
  ctxToUse.closePath();
  ctxToUse.clip();
  const goldGloss = ctxToUse.createLinearGradient(left, top, left, bottom);
  goldGloss.addColorStop(0, "rgba(255, 255, 255, 0.35)");
  goldGloss.addColorStop(0.42, "rgba(255, 255, 255, 0.06)");
  goldGloss.addColorStop(1, "rgba(160, 87, 0, 0.12)");
  ctxToUse.fillStyle = goldGloss;
  ctxToUse.fillRect(left, top, 252, bottom - top);
  ctxToUse.restore();

  ctxToUse.save();
  ctxToUse.beginPath();
  ctxToUse.moveTo(left, top);
  ctxToUse.lineTo(right, top);
  ctxToUse.lineTo(right, bottom - radius);
  ctxToUse.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctxToUse.lineTo(left + radius, bottom);
  ctxToUse.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctxToUse.lineTo(left, top);
  ctxToUse.closePath();
  ctxToUse.clip();
  ctxToUse.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctxToUse.lineWidth = 6;
  ctxToUse.lineCap = "round";
  ctxToUse.beginPath();
  ctxToUse.moveTo(168, top + 1);
  ctxToUse.bezierCurveTo(216, top + 1, 230, 602, 260, bottom + 1);
  ctxToUse.stroke();
  ctxToUse.restore();

  ctxToUse.save();
  ctxToUse.beginPath();
  ctxToUse.moveTo(left, top);
  ctxToUse.lineTo(168, top);
  ctxToUse.bezierCurveTo(216, top, 230, 602, 260, bottom);
  ctxToUse.lineTo(left + radius, bottom);
  ctxToUse.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctxToUse.lineTo(left, top);
  ctxToUse.closePath();
  ctxToUse.clip();
  ctxToUse.fillStyle = "#ffffff";
  ctxToUse.shadowColor = "rgba(123, 78, 0, 0.24)";
  ctxToUse.shadowBlur = 2;
  ctxToUse.shadowOffsetY = 2;
  ctxToUse.font = "900 76px Microsoft YaHei, Arial";
  ctxToUse.fillText(numberPart, 38, 636);
  ctxToUse.font = "900 33px Microsoft YaHei, Arial";
  ctxToUse.fillText(unitPart, 148, 636);
  ctxToUse.restore();

  ctxToUse.fillStyle = "#ffffff";
  ctxToUse.shadowColor = "rgba(0, 74, 0, 0.28)";
  ctxToUse.shadowBlur = 2;
  ctxToUse.font = "800 32px Microsoft YaHei, Arial";
  drawWrappedText(ctxToUse, `${state.brand || "邻家饭香"}  凤凰来仪`, 294, 633, 330, 34, 1);

  ctxToUse.restore();
}

function splitMarketingText() {
  return state.marketing
    .split(/\r?\n|\/|，|,|；|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildGeneratePrompt() {
  return [
    `生成需求：${promptInput.value.trim() || "参考样式图完成商品广告图生成"}`,
    `品牌：${state.brand || "邻家饭香"}`,
    `底部固定编号区域信息：${state.weight || "10斤"}`,
    `营销文字：${splitMarketingText().join("、") || "黑土种植、一年一季、鸭稻共生"}`,
    `参考样式图：${state.referenceName || "未上传"}`,
    `原始产品图：${state.originalName || "未上传"}`,
    `产品品牌 logo：${state.logoName || "默认商家 logo"}`,
  ].join("\n");
}

function drawGeneratedImage(targetCanvas, size) {
  const targetCtx = targetCanvas.getContext("2d");
  const scale = size / 670;
  targetCanvas.width = size;
  targetCanvas.height = size;
  targetCtx.save();
  targetCtx.scale(scale, scale);

  targetCtx.fillStyle = "#ca7048";
  targetCtx.fillRect(0, 0, 670, 670);

  drawRoundRect(targetCtx, 14, 18, 642, 634, 24);
  targetCtx.fillStyle = "#fffdf7";
  targetCtx.fill();

  targetCtx.fillStyle = "#ffffff";
  targetCtx.fillRect(24, 28, 292, 560);

  targetCtx.save();
  drawRoundRect(targetCtx, 316, 40, 306, 548, 8);
  targetCtx.clip();
  targetCtx.fillStyle = "#f7edd8";
  targetCtx.fillRect(316, 40, 306, 548);
  if (state.originalImage) {
    fitImage(targetCtx, state.originalImage, 316, 40, 306, 548, "cover");
  }
  targetCtx.restore();

  if (state.referenceImage) {
    targetCtx.save();
    targetCtx.globalAlpha = 0.08;
    fitImage(targetCtx, state.referenceImage, 14, 18, 642, 634, "cover");
    targetCtx.restore();
  }

  targetCtx.fillStyle = "#111111";
  targetCtx.font = "900 35px Microsoft YaHei, Arial";
  drawWrappedText(targetCtx, state.brand || "邻家饭香", 82, 76, 196, 42, 1);
  targetCtx.font = "700 10px Microsoft YaHei, Arial";
  targetCtx.fillStyle = "#5d5d5d";
  targetCtx.fillText("为人类美味和健康优质食材", 88, 101);

  drawMerchantLogo(targetCtx);

  targetCtx.fillStyle = "#000000";
  targetCtx.font = "900 62px Microsoft YaHei, Arial";
  targetCtx.fillText("东北", 82, 206);
  targetCtx.fillText("大米", 82, 282);

  const items = splitMarketingText();
  targetCtx.font = "900 28px Microsoft YaHei, Arial";
  items.forEach((item, index) => {
    const y = 358 + index * 58;
    targetCtx.fillStyle = "#d74d52";
    targetCtx.beginPath();
    targetCtx.arc(66, y - 9, 17, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.strokeStyle = "#ffffff";
    targetCtx.lineWidth = 5;
    targetCtx.beginPath();
    targetCtx.moveTo(56, y - 10);
    targetCtx.lineTo(65, y);
    targetCtx.lineTo(82, y - 23);
    targetCtx.stroke();
    targetCtx.fillStyle = "#111111";
    drawWrappedText(targetCtx, item, 108, y, 168, 32, 1);
  });

  drawBottomRibbon(targetCtx);

  targetCtx.restore();
}

function varColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function refreshSummary() {
  fieldNodes.originalState.textContent = state.originalImage ? "原始图片已上传" : "等待上传商品原图";
  fieldNodes.referenceState.textContent = state.referenceImage ? "参考文件已上传，用于参考布局/风格" : "用于参考布局/风格";
  fieldNodes.logoState.textContent = state.logoImage ? "产品品牌 logo 已上传" : "未上传时使用默认商家 logo";
  fieldNodes.weightSummary.textContent = state.weight || "10斤";
  fieldNodes.brandSummary.textContent = state.brand || "邻家饭香";
  fieldNodes.copySummary.textContent = splitMarketingText().join(" / ") || "黑土种植 / 一年一季 / 鸭稻共生";
  fieldNodes.generatedSummary.textContent = state.generated
    ? `已生成 ${state.lastSize}×${state.lastSize} JPG`
    : "尚未生成";
}

function refreshPreview() {
  drawGeneratedImage(canvas, 670);
  emptyPreview.hidden = Boolean(state.generated);
  refreshSummary();
}

function revokePendingDownload() {
  if (state.pendingDownloadUrl) {
    URL.revokeObjectURL(state.pendingDownloadUrl);
    state.pendingDownloadUrl = "";
  }
  state.pendingDownloadFilename = "";
  if (downloadFallbackLink) {
    downloadFallbackLink.hidden = true;
    downloadFallbackLink.removeAttribute("href");
    downloadFallbackLink.removeAttribute("download");
  }
  if (pageDownloadLink) {
    pageDownloadLink.hidden = true;
    pageDownloadLink.removeAttribute("href");
    pageDownloadLink.removeAttribute("download");
  }
}

function prepareDownloadBlob(size) {
  revokePendingDownload();
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = size;
  outputCanvas.height = size;
  drawGeneratedImage(outputCanvas, size);

  outputCanvas.toBlob((blob) => {
    if (!blob) return;
    state.pendingDownloadUrl = URL.createObjectURL(blob);
    state.pendingDownloadFilename = `generated-image-${size}x${size}.jpg`;
  }, "image/jpeg", 0.92);
}

function downloadPreparedJpg(size) {
  if (!state.pendingDownloadUrl) {
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = size;
    outputCanvas.height = size;
    drawGeneratedImage(outputCanvas, size);
    state.pendingDownloadUrl = outputCanvas.toDataURL("image/jpeg", 0.92);
    state.pendingDownloadFilename = `generated-image-${size}x${size}.jpg`;
  }

  const link = document.createElement("a");
  link.href = state.pendingDownloadUrl;
  link.download = state.pendingDownloadFilename || `generated-image-${size}x${size}.jpg`;
  link.rel = "noopener";
  link.dataset.generatedDownload = "true";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
  }, 2000);

  if (downloadFallbackLink) {
    downloadFallbackLink.href = state.pendingDownloadUrl;
    downloadFallbackLink.download = link.download;
    downloadFallbackLink.textContent = `点击下载 ${link.download}`;
    downloadFallbackLink.hidden = false;
  }
  if (pageDownloadLink) {
    pageDownloadLink.href = state.pendingDownloadUrl;
    pageDownloadLink.download = link.download;
    pageDownloadLink.textContent = `下载 ${link.download}`;
    pageDownloadLink.hidden = false;
  }
}

function triggerDownload(size) {
  state.generated = true;
  state.lastSize = size;
  console.log("generatePrompt", buildGeneratePrompt());
  refreshPreview();
  downloadPreparedJpg(size);
}

originalUploadButton.addEventListener("click", () => originalFileInput.click());
referenceUploadButton.addEventListener("click", () => referenceFileInput.click());
logoUploadButton.addEventListener("click", () => logoFileInput.click());
downloadButton.addEventListener("click", () => {
  openDialog(downloadDialog);
  const data = new FormData(downloadForm);
  prepareDownloadBlob(Number(data.get("resolution")) || 600);
});
focusPromptButton.addEventListener("click", () => promptInput.focus());

originalFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { image, dataUrl } = await loadImageFromFile(file);
    state.originalImage = image;
    state.originalName = file.name;
    fieldNodes.originalName.textContent = file.name;
    fieldNodes.originalThumb.src = dataUrl;
    markDirty("原始图片已上传");
    refreshPreview();
    openDialog(metadataDialog);
  } catch (error) {
    alert(error.message);
  }
});

referenceFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { image, dataUrl } = await loadImageFromFile(file);
    state.referenceImage = image;
    state.referenceName = file.name;
    fieldNodes.referenceName.textContent = file.name;
    fieldNodes.referenceThumb.src = dataUrl;
    markDirty("参考文件已上传");
    refreshPreview();
  } catch (error) {
    alert(error.message);
  }
});

logoFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { image, dataUrl } = await loadImageFromFile(file);
    state.logoImage = image;
    state.logoName = file.name;
    fieldNodes.logoName.textContent = file.name;
    fieldNodes.modalLogoName.textContent = file.name;
    fieldNodes.logoThumb.src = dataUrl;
    markDirty("产品品牌 logo 已上传");
    refreshPreview();
  } catch (error) {
    alert(error.message);
  }
});

metadataForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.weight = fieldNodes.weightInput.value.trim() || "10斤";
  state.brand = fieldNodes.brandInput.value.trim() || "邻家饭香";
  state.marketing = fieldNodes.marketingInput.value.trim() || "黑土种植\n一年一季\n鸭稻共生";
  markDirty("商品信息已保存");
  refreshPreview();
  closeDialog(metadataDialog);
});

downloadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(downloadForm);
  const size = Number(data.get("resolution")) || 600;
  triggerDownload(size);
  statusText.textContent = `${size}×${size} JPG 已生成，请点击下载链接`;
});

downloadForm.addEventListener("change", () => {
  const data = new FormData(downloadForm);
  prepareDownloadBlob(Number(data.get("resolution")) || 600);
});

window.addEventListener("beforeunload", revokePendingDownload);

promptInput.addEventListener("input", () => {
  markDirty("需求说明已更新");
  refreshPreview();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.querySelector(`#${button.dataset.closeDialog}`);
    closeDialog(dialog);
  });
});

loadBuiltInTargetLogo();
refreshPreview();
