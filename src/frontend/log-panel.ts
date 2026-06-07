export function setOutputHtml(html: string): void {
  const output = document.getElementById("outTxtBox");
  if (output) {
    output.innerHTML = html;
  }
}

export function appendOutputHtml(html: string): void {
  const output = document.getElementById("outTxtBox");
  if (!output) {
    return;
  }
  const entry = document.createElement("div");
  entry.innerHTML = html;
  output.appendChild(entry);
}

export function setError(message: string): void {
  setOutputHtml(`<span style='color:red; font-size: 20pt'>${message}</span>`);
}

export function setInfoStatus(message: string, isWarning = false): void {
  const status = document.getElementById("info-status");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle("status-warn", isWarning);
}

export function appendInfoLog(message: string): void {
  const output = document.getElementById("outTxtBox");
  if (!output) {
    return;
  }
  const line = document.createElement("div");
  line.textContent = message;
  output.appendChild(line);
}

export function characteristicText(characteristic: number): string {
  return characteristic === 0 ? "Characteristic 0 (real)" : `Characteristic ${characteristic}`;
}

export function setFieldCharacteristic(characteristic: number, shouldLog = false): void {
  const activeCharacteristic = characteristic || 0;
  const display = document.getElementById("field-characteristic");
  if (display) {
    display.textContent = characteristicText(activeCharacteristic);
  }
  if (shouldLog) {
    appendInfoLog(`${characteristicText(activeCharacteristic)}.`);
  }
}
