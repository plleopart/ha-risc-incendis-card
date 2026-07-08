class RiscIncendisCard extends HTMLElement {
  static getStubConfig() {
    return {
      entity: "sensor.pla_alfa_avui",
      tomorrow_entity: "sensor.pla_alfa_dema",
      title: "Pla Alfa",
      variant: "default",
      animations: true,
      show_tomorrow: true,
      show_update: true,
    };
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error("entity is required");
    }

    this.config = {
      title: "Pla Alfa",
      variant: "default",
      animations: true,
      show_tomorrow: true,
      show_update: true,
      ...config,
    };

    if (config.show_source === false && config.show_update === undefined) {
      this.config.show_update = false;
    }
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return this.isCompact() ? 2 : 4;
  }

  isCompact() {
    return this.config?.variant === "compact" || this.config?.compact === true;
  }

  render() {
    if (!this.config || !this._hass) {
      return;
    }

    const today = this._hass.states[this.config.entity];
    const tomorrow = this.config.tomorrow_entity
      ? this._hass.states[this.config.tomorrow_entity]
      : undefined;
    const model = buildModel(today, tomorrow, this.config);
    const variant = this.isCompact() ? "compact" : "default";
    const animated = this.config.animations === false ? "" : "animated";

    this.attachShadowOnce();
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <ha-card class="risk-card ${variant} ${animated} level-${model.levelKey}" tabindex="0" role="button">
        <button class="more-info" aria-label="Mostra detalls de ${escapeHtml(model.title)}">
          <ha-icon icon="mdi:dots-horizontal"></ha-icon>
        </button>
        ${variant === "compact" ? renderCompact(model, this.config) : renderDefault(model, this.config)}
      </ha-card>
    `;

    const card = this.shadowRoot.querySelector("ha-card");
    const moreInfo = this.shadowRoot.querySelector(".more-info");
    const showMoreInfo = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          bubbles: true,
          composed: true,
          detail: { entityId: this.config.entity },
        }),
      );
    };

    card.addEventListener("click", showMoreInfo);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        showMoreInfo(event);
      }
    });
    moreInfo.addEventListener("click", showMoreInfo);
  }

  attachShadowOnce() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
  }
}

function renderDefault(model, config) {
  return `
    <section class="hero">
      <div class="heading">
        <div class="eyebrow">${escapeHtml(model.title)}</div>
        <div class="place">${escapeHtml(model.place)}</div>
      </div>
      ${renderUpdated(model, config)}
    </section>

    <section class="main">
      <div class="flame" aria-hidden="true">
        <div class="flame-outer"></div>
        <div class="flame-inner"></div>
      </div>
      <div class="level-block">
        <div class="level-label">Avui</div>
        <div class="level-value">${escapeHtml(model.levelLabel)}</div>
        <div class="description">${escapeHtml(model.description)}</div>
      </div>
    </section>

    ${renderScale(model, "horizontal")}
    ${renderDetails(model, config)}
  `;
}

function renderCompact(model, config) {
  return `
    <section class="compact-layout">
      ${renderScale(model, "vertical")}
      <div class="compact-body">
        <section class="hero">
          <div class="heading">
            <div class="eyebrow">${escapeHtml(model.title)}</div>
            <div class="place">${escapeHtml(model.place)}</div>
          </div>
          ${renderUpdated(model, config)}
        </section>

        <section class="compact-main">
          <div>
            <div class="level-label">Avui</div>
            <div class="compact-value">${escapeHtml(model.levelLabel)}</div>
          </div>
          <div class="compact-summary">
            <div class="description">${escapeHtml(model.description)}</div>
            ${
              config.show_tomorrow
                ? `<div class="tomorrow-line">Demà: ${escapeHtml(model.tomorrowLabel)}</div>`
                : ""
            }
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderUpdated(model, config) {
  if (!config.show_update) {
    return "";
  }

  return `
    <div class="updated-pill">
      <span>Actualitzat</span>
      <strong>${escapeHtml(model.updated)}</strong>
    </div>
  `;
}

function renderScale(model, direction) {
  return `
    <section class="scale ${direction}" aria-label="Escala Pla Alfa">
      ${[0, 1, 2, 3, 4]
        .map(
          (level) => `
            <div class="scale-step ${model.level === level ? "active" : ""}">
              <span>${level}</span>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderDetails(model, config) {
  if (!config.show_tomorrow) {
    return "";
  }

  return `
    <section class="details">
      <div class="detail tomorrow">
        <span class="detail-label">Demà</span>
        <span class="detail-value">${escapeHtml(model.tomorrowLabel)}</span>
      </div>
    </section>
  `;
}

function buildModel(today, tomorrow, config) {
  const level = getOfficialLevel(today);
  const attributes = today?.attributes || {};
  const municipality = attributes.municipi || attributes.municipality || "";
  const comarca = attributes.comarca || "";
  const place = [municipality, comarca].filter(Boolean).join(" · ") || "Sense municipi";
  const description = attributes.descripcio || describeLevel(level);
  const updated = formatUpdated(attributes);
  const tomorrowLevel = getOfficialLevel(tomorrow);
  const tomorrowDescription =
    tomorrow?.attributes?.descripcio || describeLevel(tomorrowLevel);

  return {
    title: config.title || "Pla Alfa",
    place,
    level,
    levelKey: level === null ? "unknown" : String(level),
    levelLabel: level === null ? "S/D" : String(level),
    description,
    tomorrowLabel:
      tomorrowLevel === null
        ? "S/D"
        : `${tomorrowLevel} · ${tomorrowDescription.replace(/^Perill\s+/i, "")}`,
    updated,
  };
}

function getOfficialLevel(stateObj) {
  if (!stateObj || stateObj.state === "unknown" || stateObj.state === "unavailable") {
    return null;
  }

  const value = Number(stateObj.state);
  if (Number.isInteger(value) && value >= 0 && value <= 4) {
    return value;
  }

  return null;
}

function describeLevel(level) {
  const descriptions = {
    0: "Perill baix",
    1: "Perill moderat",
    2: "Perill alt",
    3: "Perill molt alt",
    4: "Perill extrem",
  };
  return level === null ? "Sense dades oficials" : descriptions[level];
}

function formatUpdated(attributes) {
  const sourceDate = attributes.ultima_actualitzacio_font;
  const sourceHour = attributes.hora_font;

  if (!sourceDate && !sourceHour) {
    return "S/D";
  }

  if (!sourceDate) {
    return sourceHour;
  }

  const parsed = new Date(sourceDate);
  if (Number.isNaN(parsed.getTime())) {
    return sourceHour ? `${sourceDate} · ${sourceHour}` : sourceDate;
  }

  const formatted = parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
  });
  return sourceHour ? `${formatted} · ${sourceHour}` : formatted;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const styles = `
  :host {
    display: block;
  }

  ha-card {
    --risk-bg: linear-gradient(135deg, #56616b, #8a949d);
    --risk-accent: #d7dde2;
    --risk-contrast: #ffffff;
    --risk-muted: rgba(255, 255, 255, 0.72);
    --risk-soft: rgba(255, 255, 255, 0.18);
    --risk-drift-duration: 18s;
    --risk-flame-duration: 3.8s;
    --risk-flame-scale: 1.025;
    position: relative;
    overflow: hidden;
    padding: 18px;
    border-radius: 18px;
    color: var(--risk-contrast);
    background: var(--risk-bg);
    background-size: 180% 180%;
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.18));
    cursor: pointer;
  }

  ha-card::before {
    content: "";
    position: absolute;
    inset: -28% -12% auto auto;
    width: 180px;
    height: 180px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    pointer-events: none;
  }

  ha-card::after {
    content: "";
    position: absolute;
    inset: auto auto -42px -34px;
    width: 170px;
    height: 170px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.1);
    pointer-events: none;
  }

  .level-0 {
    --risk-bg: linear-gradient(135deg, #f7f8f3, #2f8053);
    --risk-accent: #0f6b3d;
    --risk-contrast: #123323;
    --risk-muted: rgba(18, 51, 35, 0.72);
    --risk-soft: rgba(15, 107, 61, 0.16);
    --risk-drift-duration: 28s;
    --risk-flame-duration: 6s;
    --risk-flame-scale: 1.01;
  }

  .level-1 {
    --risk-bg: linear-gradient(135deg, #fff7ad, #c9a400);
    --risk-accent: #8b6500;
    --risk-contrast: #302500;
    --risk-muted: rgba(48, 37, 0, 0.7);
    --risk-soft: rgba(139, 101, 0, 0.14);
    --risk-drift-duration: 24s;
    --risk-flame-duration: 5.2s;
    --risk-flame-scale: 1.018;
  }

  .level-2 {
    --risk-bg: linear-gradient(135deg, #ffbd66, #f06d1a);
    --risk-accent: #8d2f00;
    --risk-contrast: #2e1300;
    --risk-muted: rgba(46, 19, 0, 0.72);
    --risk-soft: rgba(141, 47, 0, 0.16);
    --risk-drift-duration: 18s;
    --risk-flame-duration: 4s;
    --risk-flame-scale: 1.035;
  }

  .level-3 {
    --risk-bg: linear-gradient(135deg, #f45b4f, #b91717);
    --risk-accent: #ffffff;
    --risk-contrast: #ffffff;
    --risk-muted: rgba(255, 255, 255, 0.76);
    --risk-soft: rgba(255, 255, 255, 0.18);
    --risk-drift-duration: 13s;
    --risk-flame-duration: 3.2s;
    --risk-flame-scale: 1.05;
  }

  .level-4 {
    --risk-bg: linear-gradient(135deg, #6f0d12, #260305);
    --risk-accent: #ffd8d8;
    --risk-contrast: #ffffff;
    --risk-muted: rgba(255, 255, 255, 0.76);
    --risk-soft: rgba(255, 255, 255, 0.16);
    --risk-drift-duration: 10s;
    --risk-flame-duration: 2.8s;
    --risk-flame-scale: 1.065;
  }

  .animated {
    animation: risk-bg-drift var(--risk-drift-duration) ease-in-out infinite alternate;
  }

  .animated::before {
    animation: risk-glow-drift calc(var(--risk-drift-duration) * 0.75) ease-in-out infinite alternate;
  }

  .animated::after {
    animation: risk-shadow-drift calc(var(--risk-drift-duration) * 0.9) ease-in-out infinite alternate;
  }

  .hero,
  .main,
  .scale,
  .details,
  .compact-layout {
    position: relative;
    z-index: 1;
  }

  .hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .eyebrow {
    font-size: 13px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    opacity: 0.82;
  }

  .place {
    margin-top: 3px;
    font-size: 18px;
    line-height: 1.25;
    font-weight: 800;
  }

  .updated-pill {
    display: grid;
    justify-items: end;
    flex: 0 0 auto;
    max-width: 120px;
    padding: 6px 9px;
    border-radius: 12px;
    color: var(--risk-contrast);
    background: var(--risk-soft);
  }

  .updated-pill span {
    font-size: 10px;
    line-height: 1.1;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--risk-muted);
  }

  .updated-pill strong {
    margin-top: 2px;
    overflow: hidden;
    max-width: 100%;
    font-size: 13px;
    line-height: 1.15;
    font-weight: 900;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .more-info {
    position: absolute;
    z-index: 2;
    top: 8px;
    right: 8px;
    display: none;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 999px;
    color: var(--risk-contrast);
    background: rgba(255, 255, 255, 0.16);
    cursor: pointer;
  }

  ha-card:hover .more-info,
  ha-card:focus .more-info,
  ha-card:focus-within .more-info {
    display: inline-grid;
    place-items: center;
  }

  .more-info ha-icon {
    width: 20px;
    height: 20px;
  }

  .main {
    display: grid;
    grid-template-columns: 86px 1fr;
    align-items: center;
    gap: 18px;
    margin-top: 22px;
  }

  .flame {
    position: relative;
    width: 86px;
    height: 104px;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.18));
    transform-origin: 50% 86%;
  }

  .animated .flame {
    animation: flame-breathe var(--risk-flame-duration) ease-in-out infinite;
  }

  .flame-outer,
  .flame-inner {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%) rotate(-45deg);
    border-radius: 62% 8% 62% 62%;
  }

  .flame-outer {
    width: 68px;
    height: 68px;
    background: var(--risk-accent);
  }

  .flame-inner {
    width: 38px;
    height: 38px;
    bottom: 14px;
    background: rgba(255, 255, 255, 0.72);
  }

  .animated .flame-inner {
    animation: flame-core calc(var(--risk-flame-duration) * 0.82) ease-in-out infinite;
  }

  .level-label {
    font-size: 13px;
    line-height: 1;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--risk-muted);
  }

  .level-value {
    margin-top: 3px;
    font-size: 76px;
    line-height: 0.92;
    font-weight: 900;
  }

  .description {
    margin-top: 8px;
    font-size: 18px;
    line-height: 1.25;
    font-weight: 800;
  }

  .scale.horizontal {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-top: 20px;
  }

  .scale.vertical {
    display: grid;
    grid-template-rows: repeat(5, minmax(0, 1fr));
    gap: 6px;
    width: 34px;
  }

  .scale-step {
    position: relative;
    min-height: 30px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.26);
  }

  .scale-step span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 900;
    color: var(--risk-contrast);
  }

  .scale-step.active {
    background: var(--risk-contrast);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22);
  }

  .scale-step.active span {
    color: var(--risk-accent);
  }

  .details {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    margin-top: 14px;
  }

  .detail {
    min-width: 0;
    padding: 11px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.18);
  }

  .detail-label,
  .detail-value {
    display: block;
  }

  .detail-label {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--risk-muted);
  }

  .detail-value {
    overflow: hidden;
    margin-top: 3px;
    font-size: 15px;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact {
    min-height: 132px;
    padding: 14px;
  }

  .compact::before {
    width: 130px;
    height: 130px;
  }

  .compact::after {
    width: 120px;
    height: 120px;
  }

  .compact-layout {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .compact-body {
    min-width: 0;
  }

  .compact .place {
    font-size: 16px;
  }

  .compact .updated-pill {
    max-width: 105px;
    padding: 5px 8px;
  }

  .compact-main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: end;
    margin-top: 18px;
  }

  .compact-value {
    margin-top: 2px;
    font-size: 58px;
    line-height: 0.9;
    font-weight: 950;
  }

  .compact-summary {
    min-width: 0;
    padding-bottom: 4px;
  }

  .compact .description {
    overflow: hidden;
    margin-top: 0;
    font-size: 17px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tomorrow-line {
    overflow: hidden;
    margin-top: 7px;
    color: var(--risk-muted);
    font-size: 14px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes risk-bg-drift {
    0% {
      background-position: 0% 40%;
    }
    100% {
      background-position: 100% 60%;
    }
  }

  @keyframes risk-glow-drift {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 0.72;
    }
    100% {
      transform: translate3d(-16px, 18px, 0) scale(1.08);
      opacity: 0.95;
    }
  }

  @keyframes risk-shadow-drift {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
      opacity: 0.85;
    }
    100% {
      transform: translate3d(18px, -8px, 0) scale(1.06);
      opacity: 0.62;
    }
  }

  @keyframes flame-breathe {
    0%,
    100% {
      transform: translate3d(0, 0, 0) scale(1) rotate(-0.4deg);
    }
    50% {
      transform: translate3d(0, -2px, 0) scale(var(--risk-flame-scale)) rotate(0.6deg);
    }
  }

  @keyframes flame-core {
    0%,
    100% {
      opacity: 0.68;
      transform: translateX(-50%) rotate(-45deg) scale(0.96);
    }
    50% {
      opacity: 0.9;
      transform: translateX(-50%) rotate(-45deg) scale(1.05);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .animated,
    .animated::before,
    .animated::after,
    .animated .flame,
    .animated .flame-inner {
      animation: none;
    }
  }

  @media (max-width: 420px) {
    ha-card {
      padding: 16px;
    }

    .hero {
      display: block;
    }

    .updated-pill {
      justify-items: start;
      margin-top: 10px;
    }

    .main {
      grid-template-columns: 70px 1fr;
      gap: 14px;
    }

    .flame {
      width: 70px;
      height: 88px;
    }

    .flame-outer {
      width: 56px;
      height: 56px;
    }

    .flame-inner {
      width: 31px;
      height: 31px;
    }

    .level-value {
      font-size: 62px;
    }
  }
`;

if (!customElements.get("risc-incendis-card")) {
  customElements.define("risc-incendis-card", RiscIncendisCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "risc-incendis-card",
  name: "Risc Incendis Card",
  description: "Visual Pla Alfa wildfire risk card",
  preview: true,
});
