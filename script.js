import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getDatabase, ref, set, get, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBsm5fNiSVvBoXmVkw0ei43nBbPLA8L56w",
    authDomain: "marketing-management-app.firebaseapp.com",
    projectId: "marketing-management-app",
    storageBucket: "marketing-management-app.appspot.com",
    messagingSenderId: "974509706013",
    appId: "1:974509706013:web:819f32729771c15e8a6ff4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Initialize variables
let currentWeek = new Date();
let currentMonth = new Date();
let marketingData = {};
let undoStack = [];
let draggedItem = null;

// DOM elements
const loginSection = document.getElementById('loginSection');
const plannerSection = document.getElementById('plannerSection');
const signInButton = document.getElementById('signInButton');
const logoutButton = document.getElementById('logoutButton');
const prevWeekBtn = document.getElementById('prevWeek');
const nextWeekBtn = document.getElementById('nextWeek');
const weekYearSpan = document.getElementById('weekYear');
const prevWeekText = document.getElementById('prevWeekText');
const nextWeekText = document.getElementById('nextWeekText');
const marketingTable = document.getElementById('marketingTable');
const deleteWeekBtn = document.getElementById('deleteWeek');
const exportPDFBtn = document.getElementById('exportPDF');
const addCommunicationBtn = document.getElementById('addCommunication');
const addPromotionBtn = document.getElementById('addPromotion');
const trashBin = document.getElementById('trashBin');
const undoBtn = document.getElementById('undo');
const confirmDialog = document.getElementById('confirmDialog');
const confirmYesBtn = document.getElementById('confirmYes');
const confirmNoBtn = document.getElementById('confirmNo');
const userName = document.getElementById('userName');
const monthlyCalendar = document.getElementById('monthlyCalendar');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const monthYearSpan = document.getElementById('monthYear');

// Authentication
function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            console.log("User signed in:", user);
            userName.textContent = user.displayName;
            showPlannerSection();
            loadUserData(user.uid);
        }).catch((error) => {
            console.error("Error signing in:", error);
            M.toast({html: 'Error signing in. Please try again.'});
        });
}

function logout() {
    signOut(auth).then(() => {
        console.log("User signed out");
        showLoginSection();
    }).catch((error) => {
        console.error("Error signing out:", error);
        M.toast({html: 'Error signing out. Please try again.'});
    });
}

function showLoginSection() {
    loginSection.style.display = 'block';
    plannerSection.style.display = 'none';
}

function showPlannerSection() {
    loginSection.style.display = 'none';
    plannerSection.style.display = 'block';
}

// Database operations
function saveMarketingData(userId, data) {
    set(ref(database, 'users/' + userId + '/marketingData'), data)
        .then(() => {
            M.toast({html: 'Data saved successfully'});
        })
        .catch((error) => {
            console.error("Error saving data:", error);
            M.toast({html: 'Error saving data. Please try again.'});
        });
}

function loadUserData(userId) {
    get(ref(database, 'users/' + userId + '/marketingData')).then((snapshot) => {
        if (snapshot.exists()) {
            marketingData = snapshot.val();
        } else {
            marketingData = {};
        }
        updateTable();
        updateMonthlyCalendar();
    }).catch((error) => {
        console.error("Error loading user data:", error);
        M.toast({html: 'Error loading data. Please try again.'});
    });
}

// Helper functions
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDates(date) {
    const week = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1);

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        week.push(day);
    }

    return week;
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateWeekDisplay() {
    const weekDates = getWeekDates(currentWeek);
    const weekNumber = getWeekNumber(currentWeek);
    const monthName = currentWeek.toLocaleString('en-US', { month: 'long' });
    const year = currentWeek.getFullYear();
    weekYearSpan.textContent = `W${weekNumber} - ${monthName} ${year}`;

    prevWeekText.textContent = `W${getWeekNumber(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}`;
    nextWeekText.textContent = `W${getWeekNumber(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}`;

    updateTable();
}

function updateTable() {
    const weekDates = getWeekDates(currentWeek);
    const rows = marketingTable.getElementsByTagName('tr');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Update header with day names and dates
    const headerCells = rows[0].getElementsByTagName('th');
    for (let i = 1; i < headerCells.length; i++) {
        const date = weekDates[i - 1];
        headerCells[i].innerHTML = `${dayNames[i - 1]} ${date.getDate()}`;
    }

    for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];
            if (j === 0) continue; // Skip the first column
            const date = formatDate(weekDates[j - 1]);
            cell.innerHTML = '';
            cell.setAttribute('data-date', date);

            if (marketingData[date]) {
                marketingData[date].forEach((item, index) => {
                    if (item.type === 'communication' && i === 1 || item.type === 'promotion' && i === 2) {
                        const div = document.createElement('div');
                        div.className = 'marketing-item';
                        div.innerHTML = `
                            <i class="material-icons">${item.type === 'communication' ? 'campaign' : 'local_offer'}</i>
                            ${item.description}
                            <span class="delete-item material-icons">close</span>
                        `;
                        div.style.backgroundColor = item.color;
                        div.setAttribute('draggable', 'true');
                        div.setAttribute('data-index', index);
                        div.addEventListener('dragstart', dragStart);
                        div.addEventListener('click', (e) => {
                            if (!e.target.classList.contains('delete-item')) {
                                editItemColor(date, index);
                            }
                        });
                        div.querySelector('.delete-item').addEventListener('click', () => deleteMarketingItem(date, index));
                        cell.appendChild(div);
                    }
                });
            }

            cell.addEventListener('dragover', dragOver);
            cell.addEventListener('drop', drop);
        }
    }
    updateUndoButton();
    adjustTableLayout();
}

function addMarketingItem(type) {
    const description = document.getElementById(`${type}Description`).value;
    const startDate = new Date(document.getElementById(`${type}Start`).value);
    const endDate = new Date(document.getElementById(`${type}End`).value);
    const colorPicker = document.getElementById(`${type}ColorPicker`);
    const selectedColor = colorPicker.querySelector('.color-option.selected');
    const customColorPicker = document.getElementById(`${type}CustomColor`);

    if (!description || !startDate || !endDate || (!selectedColor && !customColorPicker.value)) {
        M.toast({html: 'Please fill in all fields and select a color.'});
        return;
    }

    const color = selectedColor ? selectedColor.dataset.color : customColorPicker.value;

    const currentState = JSON.parse(JSON.stringify(marketingData));
    undoStack.push(currentState);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = formatDate(d);
        if (!marketingData[date]) {
            marketingData[date] = [];
        }
        marketingData[date].push({ type, description, color });
    }

    updateTable();
    updateMonthlyCalendar();
    clearForm(type);
    saveMarketingData(auth.currentUser.uid, marketingData);
}

function clearForm(type) {
    document.getElementById(`${type}Description`).value = '';
    document.getElementById(`${type}Start`).value = '';
    document.getElementById(`${type}End`).value = '';
    document.querySelectorAll(`#${type}ColorPicker .color-option`).forEach(option => option.classList.remove('selected'));
    document.getElementById(`${type}CustomColor`).value = '#000000';
}

function deleteWeek() {
    const modal = M.Modal.getInstance(confirmDialog);
    modal.open();
}

function confirmDeleteWeek() {
    const weekDates = getWeekDates(currentWeek);
    const currentState = JSON.parse(JSON.stringify(marketingData));
    undoStack.push(currentState);

    weekDates.forEach(date => {
        delete marketingData[formatDate(date)];
    });

    updateTable();
    updateMonthlyCalendar();
    saveMarketingData(auth.currentUser.uid, marketingData);
}

function deleteMarketingItem(date, index) {
    const currentState = JSON.parse(JSON.stringify(marketingData));
    undoStack.push(currentState);

    marketingData[date].splice(index, 1);
    if (marketingData[date].length === 0) {
        delete marketingData[date];
    }

    updateTable();
    updateMonthlyCalendar();
    saveMarketingData(auth.currentUser.uid, marketingData);
}

// Drag and drop functionality
function dragStart(e) {
    draggedItem = e.target;
    e.dataTransfer.setData('text/plain', e.target.textContent);
    e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function drop(e) {
    e.preventDefault();
    const targetCell = e.target.closest('td');
    if (targetCell && draggedItem) {
        const sourceDate = draggedItem.parentNode.getAttribute('data-date');
        const targetDate = targetCell.getAttribute('data-date');
        const itemIndex = parseInt(draggedItem.getAttribute('data-index'));

        if (sourceDate !== targetDate) {
            const currentState = JSON.parse(JSON.stringify(marketingData));
            undoStack.push(currentState);

            const item = marketingData[sourceDate].splice(itemIndex, 1)[0];
            if (!marketingData[targetDate]) {
                marketingData[targetDate] = [];
            }
            marketingData[targetDate].push(item);

            updateTable();
            updateMonthlyCalendar();
            saveMarketingData(auth.currentUser.uid, marketingData);
        }
    }
    draggedItem = null;
}

// Color picker functionality
function initColorPicker(pickerId) {
    const picker = document.getElementById(pickerId);
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6'];

    colors.forEach(color => {
        const option = document.createElement('div');
        option.classList.add('color-option');
        option.style.backgroundColor = color;
        option.dataset.color = color;
        option.addEventListener('click', () => {
            picker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
        picker.appendChild(option);
    });
}

function undo() {
    if (undoStack.length > 0) {
        marketingData = undoStack.pop();
        updateTable();
        updateMonthlyCalendar();
        saveMarketingData(auth.currentUser.uid, marketingData);
    }
}

function updateUndoButton() {
    undoBtn.disabled = undoStack.length === 0;
}

// Export to PDF functionality
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    // Create the PDF document in landscape orientation
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // Create a temporary div to hold our content
    const content = document.createElement('div');
    content.style.width = '297mm'; // A4 width in landscape
    content.style.height = '210mm'; // A4 height in landscape
    content.innerHTML = `
        <h1 style="text-align: center; margin-bottom: 10px;">Marketing Planner</h1>
        <p style="text-align: center; margin-bottom: 20px;">${weekYearSpan.textContent}</p>
    `;

    // Clone the table and append it to our content
    const tableClone = marketingTable.cloneNode(true);
    tableClone.style.width = '100%';
    content.appendChild(tableClone);

    // Temporarily append the content to the body
    document.body.appendChild(content);

    // Use html2canvas on the content
    html2canvas(content, { 
        scale: 2,
        width: 297 * 3.7795275591, // Convert mm to pixels (1mm = 3.7795275591 pixels)
        height: 210 * 3.7795275591
    }).then(canvas => {
        // Remove the temporary content from the body
        document.body.removeChild(content);

        const imgData = canvas.toDataURL('image/png');

        // Add the image to the PDF, fitting it to the page width
        doc.addImage(imgData, 'PNG', 0, 0, 297, 210);
        doc.save('weekly_marketing_plan.pdf');
    }).catch(error => {
        console.error('Error generating PDF:', error);
        M.toast({html: 'Error generating PDF. Please try again.'});
        // Remove the temporary content if there's an error
        if (document.body.contains(content)) {
            document.body.removeChild(content);
        }
    });
}

// Edit item color functionality
function editItemColor(date, index) {
    const item = marketingData[date][index];
    const modal = document.createElement('div');
    modal.className = 'color-edit-modal';
    modal.innerHTML = `
        <div class="color-edit-content">
            <span class="color-edit-close">&times;</span>
            <h4>Edit Color</h4>
            <input type="color" id="editColorPicker" value="${item.color}">
            <button id="saveColorBtn" class="waves-effect waves-light btn">Save</button>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.color-edit-close');
    const saveBtn = modal.querySelector('#saveColorBtn');
    const colorPicker = modal.querySelector('#editColorPicker');

    closeBtn.onclick = () => {
        document.body.removeChild(modal);
    };

    saveBtn.onclick = () => {
        const newColor = colorPicker.value;
        const currentState = JSON.parse(JSON.stringify(marketingData));
        undoStack.push(currentState);

        item.color = newColor;
        updateTable();
        updateMonthlyCalendar();
        saveMarketingData(auth.currentUser.uid, marketingData);
        document.body.removeChild(modal);
    };

    modal.style.display = 'block';
}

// Function to adjust table layout
function adjustTableLayout() {
    const table = document.getElementById('marketingTable');
    const cells = table.getElementsByTagName('td');
    let maxHeight = 0;

    // Find the maximum height among all cells
    for (let i = 0; i < cells.length; i++) {
        const cellHeight = cells[i].offsetHeight;
        if (cellHeight > maxHeight) {
            maxHeight = cellHeight;
        }
    }

    // Set all cells to the maximum height
    for (let i = 0; i < cells.length; i++) {
        cells[i].style.height = maxHeight + 'px';
    }
}

// Monthly calendar functionality
function updateMonthlyCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    let calendarHTML = '<table class="monthly-calendar"><thead><tr>';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
        calendarHTML += `<th>${dayNames[i]}</th>`;
    }
    calendarHTML += '</tr></thead><tbody>';

    let day = 1;
    for (let i = 0; i < 6; i++) {
        calendarHTML += '<tr>';
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startingDay) {
                calendarHTML += '<td></td>';
            } else if (day > daysInMonth) {
                calendarHTML += '<td></td>';
            } else {
                const date = formatDate(new Date(year, month, day));
                let cellContent = `<div class="day-number">${day}</div>`;
                if (marketingData[date]) {
                    marketingData[date].forEach(item => {
                        cellContent += `<div class="calendar-item" style="background-color: ${item.color}">
                            <i class="material-icons tiny">${item.type === 'communication' ? 'campaign' : 'local_offer'}</i>
                            ${item.description}
                        </div>`;
                    });
                }
                calendarHTML += `<td class="calendar-day" data-date="${date}">${cellContent}</td>`;
                day++;
            }
        }
        calendarHTML += '</tr>';
        if (day > daysInMonth) break;
    }
    calendarHTML += '</tbody></table>';

    monthlyCalendar.innerHTML = calendarHTML;
    updateMonthDisplay();
}

function updateMonthDisplay() {
    const monthName = currentMonth.toLocaleString('en-US', { month: 'long' });
    const year = currentMonth.getFullYear();
    monthYearSpan.textContent = `${monthName} ${year}`;

    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    document.getElementById('prevMonthText').textContent = prevMonth.toLocaleString('en-US', { month: 'short' });
    document.getElementById('nextMonthText').textContent = nextMonth.toLocaleString('en-US', { month: 'short' });
}

// Event listeners
signInButton.addEventListener('click', signInWithGoogle);
logoutButton.addEventListener('click', logout);
prevWeekBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() - 7);
    updateWeekDisplay();
});
nextWeekBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() + 7);
    updateWeekDisplay();
});
prevMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateMonthlyCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateMonthlyCalendar();
});
deleteWeekBtn.addEventListener('click', deleteWeek);
confirmYesBtn.addEventListener('click', confirmDeleteWeek);
confirmNoBtn.addEventListener('click', () => {
    const modal = M.Modal.getInstance(confirmDialog);
    modal.close();
});
exportPDFBtn.addEventListener('click', exportToPDF);
addCommunicationBtn.addEventListener('click', () => addMarketingItem('communication'));
addPromotionBtn.addEventListener('click', () => addMarketingItem('promotion'));
undoBtn.addEventListener('click', undo);

trashBin.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
});

trashBin.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedItem) {
        const sourceDate = draggedItem.parentNode.getAttribute('data-date');
        const itemIndex = parseInt(draggedItem.getAttribute('data-index'));
        deleteMarketingItem(sourceDate, itemIndex);
    }
});

// Initialize color pickers
initColorPicker('communicationColorPicker');
initColorPicker('promotionColorPicker');

// Initialize Materialize components
document.addEventListener('DOMContentLoaded', function() {
    M.Modal.init(document.querySelectorAll('.modal'));
    M.Tabs.init(document.querySelectorAll('.tabs'));
});

// Resize observer to adjust table layout on window resize
const resizeObserver = new ResizeObserver(() => {
    adjustTableLayout();
});
resizeObserver.observe(document.getElementById('marketingTable'));

// Initial update and load data
auth.onAuthStateChanged((user) => {
    if (user) {
        userName.textContent = user.displayName;
        showPlannerSection();
        loadUserData(user.uid);
    } else {
        showLoginSection();
    }
    updateWeekDisplay();
    updateMonthlyCalendar();
});