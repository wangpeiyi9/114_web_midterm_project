/* ---------- DOM 元件 ---------- */
const bookingForm = document.querySelector('#bookingForm');
const dateSelect = document.querySelector('#date');
const timeslotContainer = document.querySelector('#timeslotContainer');
const submitBtn = document.querySelector('#submitBtn');
const resetBtn = document.querySelector('#resetBtn');
const alertBox = document.querySelector('#alertBox');
const purposeFeedback = document.querySelector('#purposeFeedback');
const timeFeedback = document.querySelector('#timeFeedback');
const darkToggle = document.querySelector('#darkToggle');

const CONFIRM_MODAL_EL = document.querySelector('#confirmModal');
const bootstrapModal = new bootstrap.Modal(CONFIRM_MODAL_EL);
const confirmContent = document.querySelector('#confirmContent');
const modalConfirmBtn = document.querySelector('#modalConfirm');

const TIMESLOT_START = 10; // 10:00
const TIMESLOT_END = 20; // 20:00
const TIMESLOT_STEP_MIN = 30; // 30 分鐘
const MAX_PER_SLOT = 3; // 已預約三組即滿位

let selectedTime = null; // 所選時段字串 e.g. "10:30"

/* ---------- localStorage 管理 ---------- */
const STORAGE_KEY = 'restaurant_bookings_v1';

// 取得儲存的預約陣列（若無則回傳 []）
function loadBookings(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('讀取 localStorage 失敗', e);
    return [];
  }
}

// 儲存新的 booking 物件
function saveBooking(booking){
  const arr = loadBookings();
  arr.push(booking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* ---------- 日期產生（今天起可預約到未來 6 天，共 7 天） ---------- */
function pad(n){ return n < 10 ? '0'+n : String(n); }

function formatDateISO(date){ // YYYY-MM-DD（value）
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function formatDateLabel(date){ // e.g. 11/05 (三)
  const weekday = ['日','一','二','三','四','五','六'][date.getDay()];
  return `${pad(date.getMonth()+1)}/${pad(date.getDate())}（${weekday}）`;
}

function populateDateOptions(){
  dateSelect.innerHTML = '';
  const today = new Date();
  for(let i=0;i<7;i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const opt = document.createElement('option');
    opt.value = formatDateISO(d);
    opt.textContent = (i === 0) ? `今天 ${formatDateLabel(d)}` : formatDateLabel(d);
    dateSelect.appendChild(opt);
  }
}

/* ---------- 產生時段（每 30 分鐘） ---------- */
function timeSlotsForDay(){
  const slots = [];
  for(let hour = TIMESLOT_START; hour <= TIMESLOT_END; hour++){
    for(let min = 0; min < 60; min += TIMESLOT_STEP_MIN){
      // 如果是 20:30 則超出結束時間（20:00 為最後一個）
      if(hour === TIMESLOT_END && min > 0) continue;
      slots.push(`${pad(hour)}:${pad(min)}`);
    }
  }
  return slots;
}

/* ---------- 檢查某日期某時段是否已滿（>= MAX_PER_SLOT） ---------- */
function countBookingsFor(dateISO, time){
  const arr = loadBookings();
  return arr.filter(b => b.date === dateISO && b.time === time).length;
}

/* ---------- 渲染時段按鈕（帶上已滿狀態） ---------- */
function renderTimeSlotsFor(dateISO){
  timeslotContainer.innerHTML = '';
  selectedTime = null;
  timeFeedback.style.display = 'none';

  const slots = timeSlotsForDay();
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-primary btn-sm';
    btn.textContent = slot;
    btn.dataset.time = slot;

    const count = countBookingsFor(dateISO, slot);
    if(count >= MAX_PER_SLOT){
      btn.classList.add('btn-outline-secondary');
      btn.disabled = true;
      btn.textContent = `${slot}（已滿）`;
    }

    // 點擊選擇時段
    btn.addEventListener('click', (e) => {
      // 取消其他按鈕 selected
      timeslotContainer.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTime = slot;
      timeFeedback.style.display = 'none';
    });

    timeslotContainer.appendChild(btn);
  });
}

/* ---------- 驗證電話 ---------- */
function isValidPhone(phone){
  // 允許 + 與數字，長度 7~15
  const clean = phone.replace(/\s+/g,'');
  return /^\+?\d{7,15}$/.test(clean);
}

/* ---------- 驗證 Email ---------- */
function isValidEmail(email){
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/* ---------- 檢查用餐目的至少一項被選取 ---------- */
function isPurposeSelected(){
  const checks = bookingForm.querySelectorAll('input[name="purpose"]:checked');
  return checks.length > 0;
}

/* ---------- 要顯示在確認視窗的內容 ---------- */
function buildConfirmHtml(data){
  return `
    <dl class="row">
      <dt class="col-4">姓名</dt><dd class="col-8">${escapeHtml(data.name)}</dd>
      <dt class="col-4">電話</dt><dd class="col-8">${escapeHtml(data.phone)}</dd>
      <dt class="col-4">Email</dt><dd class="col-8">${escapeHtml(data.email)}</dd>
      <dt class="col-4">人數</dt><dd class="col-8">${escapeHtml(data.people)}</dd>
      <dt class="col-4">日期 / 時段</dt><dd class="col-8">${escapeHtml(data.date)} ${escapeHtml(data.time)}</dd>
      <dt class="col-4">用餐目的</dt><dd class="col-8">${escapeHtml(data.purpose.join(', '))}</dd>
      <dt class="col-4">備註</dt><dd class="col-8">${escapeHtml(data.note || '無')}</dd>
    </dl>
  `;
}

/* 輔助：簡單 escape 防 XSS（輸出到 modal） */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}

/* ---------- 表單送出：先驗證、再顯示 confirm modal ---------- */
bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  e.stopPropagation();

  // 使用 Constraint Validation API 的基本驗證
  if(!bookingForm.checkValidity()){
    bookingForm.classList.add('was-validated');
  }

  // 自訂電話 / email 驗證
  const phoneInput = document.querySelector('#phone');
  const emailInput = document.querySelector('#email');

  if(!isValidPhone(phoneInput.value)){
    phoneInput.setCustomValidity('invalidPhone');
  } else {
    phoneInput.setCustomValidity('');
  }
  if(!isValidEmail(emailInput.value)){
    emailInput.setCustomValidity('invalidEmail');
  } else {
    emailInput.setCustomValidity('');
  }

  // 用餐目的至少選一
  if(!isPurposeSelected()){
    purposeFeedback.style.display = 'block';
  } else {
    purposeFeedback.style.display = 'none';
  }

  // 時段是否選擇
  if(!selectedTime){
    timeFeedback.style.display = 'block';
  } else {
    timeFeedback.style.display = 'none';
  }

  // 若其中一個驗證失敗，return
  if(!bookingForm.checkValidity() || !isPurposeSelected() || !selectedTime){
    bookingForm.classList.add('was-validated');
    return;
  }

  // 如果全部驗證通過，組資料並填入 modal
  const data = {
    name: bookingForm.name.value.trim(),
    phone: bookingForm.phone.value.trim(),
    email: bookingForm.email.value.trim(),
    people: bookingForm.people.value,
    date: bookingForm.date.value,
    time: selectedTime,
    purpose: Array.from(bookingForm.querySelectorAll('input[name="purpose"]:checked')).map(i => i.value),
    note: bookingForm.note.value.trim(),
    createdAt: new Date().toISOString()
  };

  confirmContent.innerHTML = buildConfirmHtml(data);
  // 把 data 暫時存在 modalConfirmBtn.dataset，等按下確認再取出
  modalConfirmBtn.dataset.pending = JSON.stringify(data);
  bootstrapModal.show();
});

/* ---------- Modal 確認按鈕：存入 localStorage 並顯示成功訊息 ---------- */
modalConfirmBtn.addEventListener('click', () => {
  const raw = modalConfirmBtn.dataset.pending;
  if(!raw) return;
  const data = JSON.parse(raw);

  // 再次檢查該時段是否已滿（避免 race condition）
  const cnt = countBookingsFor(data.date, data.time);
  if(cnt >= MAX_PER_SLOT){
    alert('抱歉該時段在您送出前已額滿，請重新選擇其他時段或日期。');
    bootstrapModal.hide();
    renderTimeSlotsFor(dateSelect.value);
    return;
  }

  // 儲存
  saveBooking(data);

  // UI：顯示成功訊息、關閉 modal、重設表單
  bootstrapModal.hide();
  alertBox.textContent = `✅ ${data.name}，訂位成功！${data.date} ${data.time}（${data.people} 人）`;
  alertBox.classList.remove('d-none');
  alertBox.classList.add('show');

  // 防止重複送出：短暫停用 submit 按鈕
  submitBtn.disabled = true;
  setTimeout(()=> submitBtn.disabled = false, 1200);

  bookingForm.reset();
  bookingForm.classList.remove('was-validated');

  // 重新渲染時段（可能剛存入使某時段達到上限）
  renderTimeSlotsFor(dateSelect.value);

  // 清除 modal pending data
  delete modalConfirmBtn.dataset.pending;
});

/* ---------- reset 按鈕 ---------- */
resetBtn.addEventListener('click', () => {
  bookingForm.reset();
  bookingForm.classList.remove('was-validated');
  purposeFeedback.style.display = 'none';
  timeFeedback.style.display = 'none';
  selectedTime = null;
  renderTimeSlotsFor(dateSelect.value);
});

/* ---------- 當日期改變，重新渲染時段 ---------- */
dateSelect.addEventListener('change', (e) => {
  renderTimeSlotsFor(dateSelect.value);
});

/* ---------- 深色模式切換（記住在 localStorage） ---------- */
function applyDarkMode(enabled){
  if(enabled){
    document.body.classList.add('dark-mode');
    darkToggle.textContent = '淺色模式';
  } else {
    document.body.classList.remove('dark-mode');
    darkToggle.textContent = '深色模式';
  }
}
darkToggle.addEventListener('click', () => {
  const current = localStorage.getItem('darkMode') === 'true';
  localStorage.setItem('darkMode', (!current).toString());
  applyDarkMode(!current);
});
applyDarkMode(localStorage.getItem('darkMode') === 'true');

/* ---------- 初始呼叫 ---------- */
(function init(){
  populateDateOptions();
  // 選第一個（今天）
  dateSelect.selectedIndex = 0;
  renderTimeSlotsFor(dateSelect.value);
})();