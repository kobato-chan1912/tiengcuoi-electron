const $ = require('jquery')
const { ipcRenderer, webUtils } = require('electron');


const fs = require('fs');
const path = require('path');

const buttonContainer = document.getElementById('button-container');
const baseFolder = path.join(__dirname, 'data');
let currentAudio = null;
let mixedMode = false;
let shortcutMode = false;
let allAudios = [];
let currentCategory = 'effect';



function loadFiles(category) {
    buttonContainer.innerHTML = '';
    currentCategory = category;

    const dbPath = path.join(__dirname, 'database.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    const filtered = data.filter(item => item.type === category);


    const rowSize = 3;
    for (let i = 0; i < filtered.length; i += rowSize) {
        const row = document.createElement('div');
        row.className = 'row';
        for (let j = 0; j < rowSize && i + j < filtered.length; j++) {
            const file = filtered[i + j];
            const col = document.createElement('div');
            col.className = 'col text-center';

            const button = document.createElement('button');
            button.className = 'cute-btn';
            button.textContent = file.label;
            button.onclick = () => playSound(file.path);

            col.appendChild(button);
            row.appendChild(col);
        }
        buttonContainer.appendChild(row);
    }
}


function playSound(filePath) {
    const volumeSlider = document.getElementById('volumeSlider');
    const volume = parseInt(volumeSlider.value) / 100;

    if (mixedMode) {
        const audio = new Audio(filePath);
        audio.volume = volume;
        audio.play();
        allAudios.push(audio);

        audio.addEventListener('ended', () => {
            allAudios = allAudios.filter(a => a !== audio);
        });
    } else {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(filePath);
        currentAudio.volume = volume;
        currentAudio.play();
    }
}


function stopSound() {
    allAudios.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    allAudios = [];
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

}

// Gán các sự kiện vào nút
window.onload = () => {
    loadFiles('effect');

    const headerButtons = document.querySelectorAll('.header-btn');
    headerButtons[0].onclick = () => loadFiles('effect');
    headerButtons[1].onclick = () => loadFiles('music');
    headerButtons[2].onclick = stopSound;

    // Modal controls
    const settingsBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.querySelector('.close');
    const mixToggle = document.getElementById('mix-toggle');
    const shortcutToogle = document.getElementById('shortcut-toogle');

    settingsBtn.onclick = () => modal.style.display = 'block';
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = 'none';
    }

    mixToggle.onchange = () => {
        mixedMode = mixToggle.checked;
        stopSound(); // Clear any current sound when mode switches
    };

    shortcutToogle.onchange = () => {
        shortcutMode = shortcutToogle.checked;
    };

    // Volume live update
    document.getElementById('volumeSlider').oninput = (e) => {
        const vol = parseInt(e.target.value) / 100;
        if (mixedMode) {
            allAudios.forEach(a => a.volume = vol);
        } else if (currentAudio) {
            currentAudio.volume = vol;
        }
    };
};



document.addEventListener('keydown', (e) => {
    const checkModalOpen = document.querySelector("#customShortcutModal").style.display
    if (shortcutMode && checkModalOpen=='none') {
        const key = e.key.toUpperCase();
        const dbPath = path.join(__dirname, 'database.json');
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        const match = data.find(item => item.shortcut === key);
        if (match) {
            playSound(match.path);
        }
    }

});


const dbPath = path.join(__dirname, 'database.json');
const defaultDbPath = path.join(__dirname, 'default_database.json');

function openShortcutModal() {
    const dbPath = path.join(__dirname, 'database.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const container = document.getElementById('shortcutSettings');
    container.innerHTML = '';

    data.forEach((item, index) => {
        const row = document.createElement('tr');

        // Label
        const labelCell = document.createElement('td');
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.value = item.label;
        labelInput.className = 'form-control';
        labelInput.dataset.index = index;
        labelInput.dataset.field = 'label';
        labelCell.appendChild(labelInput);
        row.appendChild(labelCell);

        // Path
        const pathCell = document.createElement('td');
        const pathInput = document.createElement('input');
        pathInput.type = 'text';
        pathInput.value = item.path;
        pathInput.className = 'form-control';
        pathInput.dataset.index = index;
        pathInput.dataset.field = 'path';
        pathCell.appendChild(pathInput);
        row.appendChild(pathCell);

        // Type
        const typeCell = document.createElement('td');
        const typeSelect = document.createElement('select');
        typeSelect.className = 'form-select';
        typeSelect.dataset.index = index;
        typeSelect.dataset.field = 'type';

        ['effect', 'music'].forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.text = t === 'effect' ? 'Hiệu ứng' : 'Nhạc';
            if (item.type === t) opt.selected = true;
            typeSelect.appendChild(opt);
        });
        typeCell.appendChild(typeSelect);
        row.appendChild(typeCell);

        // Shortcut
        const shortcutCell = document.createElement('td');
        const shortcutInput = document.createElement('input');
        shortcutInput.type = 'text';
        shortcutInput.value = item.shortcut || '';
        shortcutInput.readOnly = true;
        shortcutInput.className = 'form-control text-center';
        shortcutInput.dataset.index = index;
        shortcutInput.dataset.field = 'shortcut';
        shortcutInput.addEventListener('keydown', (e) => {
            e.preventDefault();
            shortcutInput.value = e.key.toUpperCase();
        });
        shortcutCell.appendChild(shortcutInput);
        row.appendChild(shortcutCell);

        // Upload + Delete (Actions)
        const actionCell = document.createElement('td');

        // Upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-sm btn-outline-secondary me-1';
        uploadBtn.textContent = '📁';
        uploadBtn.onclick = async () => {
            const filePath = await ipcRenderer.invoke('dialog:openFile');
            if (filePath) {
                pathInput.value = filePath;
            }
        };
        actionCell.appendChild(uploadBtn);

        // Delete button (only if not builtin)
        if (!item.builtin) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-outline-secondary';
            delBtn.textContent = '❌';
            delBtn.onclick = () => {
                data.splice(index, 1);
                fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
                openShortcutModal(); // Reload table
            };
            actionCell.appendChild(delBtn);
        }

        row.appendChild(actionCell);


        container.appendChild(row);
    });

    document.getElementById('customShortcutModal').style.display = 'flex';
}


function closeShortcutModal() {
    document.getElementById('customShortcutModal').style.display = 'none';
}

function saveShortcuts() {
    const dbPath = path.join(__dirname, 'database.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    document.querySelectorAll('#shortcutSettings input, #shortcutSettings select').forEach(el => {
        const index = parseInt(el.dataset.index);
        const field = el.dataset.field;
        if (index >= 0 && field && data[index]) {
            data[index][field] = el.value;
        }
    });

    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    alert('Đã lưu cài đặt');
    openShortcutModal(); // reload để cập nhật
    loadFiles(currentCategory)
}


function addNewShortcutRow() {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    data.push({
        label: 'Mới',
        type: 'effect',
        path: '',
        shortcut: '',
        builtin: false
    });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    openShortcutModal();
}

function deleteEntry(index) {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!data[index].builtin) {
        data.splice(index, 1);
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        openShortcutModal();
    }
}

function resetDatabase() {
    fs.copyFileSync(defaultDbPath, dbPath);
    alert('Đã khôi phục dữ liệu mặc định');
    openShortcutModal();
}

async function chooseFile(index) {
    const filePath = await ipcRenderer.invoke('dialog:openFile');
    if (!filePath) return;

    const dbPath = path.join(__dirname, 'database.json');
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    data[index].path = filePath;
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

    openShortcutModal(); // hoặc reload UI tương ứng
}

