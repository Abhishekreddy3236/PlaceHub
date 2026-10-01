class ExportLimiter {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentExports = 0;
  }

  tryAcquire() {
    if (this.currentExports >= this.maxConcurrent) {
      return false;
    }
    this.currentExports++;
    return true;
  }

  release() {
    if (this.currentExports > 0) {
      this.currentExports--;
    }
  }

  getCurrentCount() {
    return this.currentExports;
  }
}

const applicationExportLimiter = new ExportLimiter(2);

module.exports = {
  applicationExportLimiter,
  ExportLimiter
};
