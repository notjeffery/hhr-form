// Total number of steps in the full application
const TOTAL_STEPS = 10;

// Set to false while still building/reviewing the form so you can click through
// without filling every field. Set back to true when ready to enforce validation.
const ENFORCE_VALIDATION = false;

// Human-readable labels shown next to "Step X of Y"
const STEP_LABELS = {
  1: "Student Information",
  2: "Education Information",
  3: "Household & Living Situation",
  4: "Emergency Assistance Request",
  5: "Description of Need",
  6: "Financial Impact",
  7: "Income & Support Information",
  8: "Supporting Documentation",
  9: "Student Statement",
  10: "Declaration and Penalty Notice"
};

let currentStep = 1;

const steps = document.querySelectorAll(".form-step");
const btnBack = document.getElementById("btn-back");
const btnNext = document.getElementById("btn-next");
const progressFill = document.getElementById("progress-fill");
const stepLabel = document.getElementById("step-label");
const stepCount = document.getElementById("step-count");

/* ---------------------------------------------------
   CONDITIONAL FIELDS
   Show/require a field only when a related answer is given.
--------------------------------------------------- */

// Section 3: dependents detail fields, shown only if hasDependents = yes
function toggleDependentsDetails() {
  const yesSelected = document.querySelector('input[name="hasDependents"][value="yes"]').checked;
  const wrap = document.getElementById("dependents-details");
  wrap.hidden = !yesSelected;
  wrap.querySelectorAll("[data-conditional-required]").forEach((el) => {
    if (yesSelected) {
      el.setAttribute("required", "required");
    } else {
      el.removeAttribute("required");
      el.value = "";
    }
  });
}
document.querySelectorAll('input[name="hasDependents"]').forEach((el) => {
  el.addEventListener("change", toggleDependentsDetails);
});

// Section 4 / 7: "Other" checkbox reveals a required text field
function wireOtherCheckbox(checkboxId, textInputName) {
  const checkbox = document.getElementById(checkboxId);
  if (!checkbox) return;
  const textInput = document.querySelector(`input[name="${textInputName}"]`);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      textInput.setAttribute("required", "required");
    } else {
      textInput.removeAttribute("required");
      textInput.value = "";
    }
  });
}
wireOtherCheckbox("assistanceOtherCheckbox", "assistanceTypeOther");
wireOtherCheckbox("supportOtherCheckbox", "financialSupportOther");

// Section 3: "Other" living situation radio reveals a required text field
document.querySelectorAll('input[name="livingSituation"]').forEach((el) => {
  el.addEventListener("change", () => {
    const otherInput = document.querySelector('input[name="livingSituationOther"]');
    if (el.value === "other" && el.checked) {
      otherInput.setAttribute("required", "required");
    } else if (el.checked) {
      otherInput.removeAttribute("required");
      otherInput.value = "";
    }
  });
});

// Section 6: explanation textarea shown only if enrollmentImpact = yes
function toggleEnrollmentImpactExplain() {
  const yesSelected = document.querySelector('input[name="enrollmentImpact"][value="yes"]').checked;
  const wrap = document.getElementById("enrollmentImpactExplain-wrap");
  wrap.hidden = !yesSelected;
  const textarea = document.getElementById("enrollmentImpactExplain");
  if (yesSelected) {
    textarea.setAttribute("required", "required");
  } else {
    textarea.removeAttribute("required");
    textarea.value = "";
  }
}
document.querySelectorAll('input[name="enrollmentImpact"]').forEach((el) => {
  el.addEventListener("change", toggleEnrollmentImpactExplain);
});

// Section 7: tax filing date shown only if "Already filed" selected
function toggleTaxFilingDate() {
  const select = document.getElementById("taxFilingStatus");
  const wrap = document.getElementById("taxFilingDate-wrap");
  const dateInput = document.getElementById("taxFilingDate");
  const showDate = select.value === "already-filed";
  wrap.hidden = !showDate;
  if (showDate) {
    dateInput.setAttribute("required", "required");
  } else {
    dateInput.removeAttribute("required");
    dateInput.value = "";
  }
}
document.getElementById("taxFilingStatus").addEventListener("change", toggleTaxFilingDate);

/* ---------------------------------------------------
   VALIDATION
--------------------------------------------------- */

function clearErrors(stepEl) {
  stepEl.querySelectorAll(".field").forEach((f) => f.classList.remove("has-error"));
  stepEl.querySelectorAll(".checkbox-group").forEach((g) => g.classList.remove("has-error"));
  stepEl.querySelectorAll(".field-error").forEach((e) => e.classList.remove("show-error"));
}

function validateStep(stepEl) {
  if (!ENFORCE_VALIDATION) return true;

  let valid = true;
  clearErrors(stepEl);

  // Standard inputs, selects, textareas with "required"
  const requiredEls = stepEl.querySelectorAll("input[required], select[required], textarea[required]");
  requiredEls.forEach((el) => {
    if (!el.checkValidity()) {
      valid = false;
      const fieldWrap = el.closest(".field") || el.closest(".field-group");
      if (fieldWrap) fieldWrap.classList.add("has-error");
    }
  });

  // Checkbox groups requiring at least one selection
  const checkboxGroups = stepEl.querySelectorAll('.checkbox-group[data-required="true"]');
  checkboxGroups.forEach((group) => {
    const checked = group.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) {
      valid = false;
      group.classList.add("has-error");
      const groupName = group.dataset.groupName;
      const errorEl = stepEl.querySelector(`.field-error[data-error-for="${groupName}"]`);
      if (errorEl) errorEl.classList.add("show-error");
    }
  });

  return valid;
}

/* ---------------------------------------------------
   STEP RENDERING / NAVIGATION
--------------------------------------------------- */

function renderStep() {
  steps.forEach((step) => {
    const stepNum = parseInt(step.dataset.step, 10);
    step.hidden = stepNum !== currentStep;
  });

  btnBack.disabled = currentStep === 1;
  stepLabel.textContent = STEP_LABELS[currentStep] || "";
  stepCount.textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;
  progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
  btnNext.textContent = currentStep === steps.length ? "Submit Application" : "Next →";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

btnNext.addEventListener("click", () => {
  const activeStep = document.querySelector(`.form-step[data-step="${currentStep}"]`);

  if (!validateStep(activeStep)) {
    const firstError = activeStep.querySelector(".has-error");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (currentStep < steps.length) {
    currentStep++;
    renderStep();
  } else {
    // No backend connected yet — this just shows the confirmation modal.
    // Actual submission (saving/emailing the data) still needs to be wired up.
    document.getElementById("submit-modal").hidden = false;
  }
});

btnBack.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    renderStep();
  }
});

renderStep();

document.getElementById("modal-continue-btn").addEventListener("click", () => {
  window.location.href = "index.html";
});