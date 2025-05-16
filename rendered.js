const $ = require('jquery')
const { ipcRenderer, webUtils, app } = require('electron');
const shell = require('electron').shell;
const { machineIdSync } = require('node-machine-id');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const buttonContainer = document.getElementById('button-container');
const baseFolder = path.join(__dirname, 'data');
let currentAudio = null;
let mixedMode = false;
let shortcutMode = false;
let allAudios = [];
let currentCategory = 'effect';

const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');

dotenv.config({ path: envPath });

const DOMAIN = process.env.DOMAIN;

let dbPath = null;

ipcRenderer.invoke('get-db-path').then(db => {
    dbPath = db;
    console.log('dbPath:', dbPath);
    // sử dụng dbPath ở đây
});


const defaultDbPath = path.join(__dirname, 'default_database.json');

function loadFiles(category) {
    buttonContainer.innerHTML = '';
    currentCategory = category;

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    let filtered = data.filter(item => item.type === category);

    if (licenseTypeGlobal === 'free') {
        filtered = filtered.filter(item => item.access === 'free');
    }
    filtered.sort((a, b) => (a.stt || 0) - (b.stt || 0));

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


function normalizePath(filePath) {
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath).normalize('NFC');
    return path.join(dirname, basename);
}



function playSound(fPath) {
    let filePath = normalizePath(fPath)
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

    const headerButtons = document.querySelectorAll('.header-btn');
    headerButtons[0].onclick = () => loadFiles('effect');
    headerButtons[1].onclick = () => loadFiles('music');
    headerButtons[2].onclick = stopSound;

    // Modal controls
    const settingsBtn = document.getElementById('settings-btn');
    const keyBtn = document.getElementById('enter-key-btn');

    const settingsModal = document.getElementById('settings-modal');
    const keyModal = document.getElementById('key-modal');

    const allModals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');

    // Hàm đóng tất cả modal
    function closeAllModals() {
        allModals.forEach(modal => modal.style.display = 'none');
    }

    // Gán sự kiện cho nút mở modal
    settingsBtn.onclick = () => {
        // if (licenseTypeGlobal === 'free') {
        //     // alert('Vui lòng nâng cấp để mở khóa tính năng này!');
        //     return;
        // }
        closeAllModals();
        settingsModal.style.display = 'block';
    };

    keyBtn.onclick = () => {
        closeAllModals();
        keyModal.style.display = 'block';
    };

    // Gán sự kiện cho tất cả nút close
    closeButtons.forEach(btn => {
        btn.onclick = closeAllModals;
    });

    // Gán sự kiện click ra ngoài để đóng modal
    window.onclick = (event) => {
        allModals.forEach(modal => {
            if (event.target === modal) {
                closeAllModals();
            }
        });
    };



    const mixToggle = document.getElementById('mix-toggle');
    const shortcutToogle = document.getElementById('shortcut-toogle');
    const TopToggle = document.getElementById('top-toggle');

    TopToggle.onchange = () => {
        const isChecked = TopToggle.checked;
        ipcRenderer.send('toggle-always-on-top', isChecked);
        
    };

    

    mixToggle.onchange = () => {
        if (licenseTypeGlobal === 'free') {
            alert('Vui lòng nâng cấp để mở khóa tính năng này!');
            mixToggle.checked = !mixToggle.checked;
            return;
        }
        mixedMode = mixToggle.checked;
        stopSound(); // Clear any current sound when mode switches
    };

    shortcutToogle.onchange = () => {
        if (licenseTypeGlobal === 'free') {
            alert('Vui lòng nâng cấp để mở khóa tính năng này!');
            shortcutToogle.checked = !shortcutToogle.checked;
            return;
        }
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
    if (shortcutMode && checkModalOpen == 'none') {
        const key = e.key.toUpperCase();
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        const match = data.find(item => item.shortcut === key);
        if (match) {
            playSound(match.path);
        }
    }

});



function openShortcutModal() {
    if (licenseTypeGlobal === 'free') {
        alert('Vui lòng nâng cấp để mở khóa tính năng này!');
        return;
    }
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    data.sort((a, b) => {
        const sttA = parseInt(a.stt) || 0;
        const sttB = parseInt(b.stt) || 0;
        return sttA - sttB;
    });


    const container = document.getElementById('shortcutSettings');
    container.innerHTML = '';

    data.forEach((item, index) => {
        const row = document.createElement('tr');


        // STT
        const sttCell = document.createElement('td');
        const sttInput = document.createElement('input');
        sttInput.type = 'number';
        sttInput.value = item.stt || index + 1;
        sttInput.className = 'form-control text-center';
        sttInput.dataset.index = index;
        sttInput.dataset.field = 'stt';
        sttCell.appendChild(sttInput);
        row.appendChild(sttCell);




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
        builtin: false,
        stt: data.length + 1
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
    loadFiles(currentCategory)
}

async function chooseFile(index) {
    const filePath = await ipcRenderer.invoke('dialog:openFile');
    if (!filePath) return;

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    data[index].path = filePath;
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

    openShortcutModal(); // hoặc reload UI tương ứng
}

// ads
document.addEventListener('DOMContentLoaded', function () {
    loadAds();
});

// load ads
async function loadAds() {
    try {
        const response = await fetch(`${DOMAIN}/api/ads`);
        const ads = await response.json();

        const listContainer = document.querySelector('#ad-slider .splide__list');
        listContainer.innerHTML = ''; // clear old content

        ads
            .filter(ad => ad.status === 1)
            .forEach(ad => {
                const li = document.createElement('li');
                li.classList.add('splide__slide');

                const anchor = document.createElement('a');
                anchor.href = "javascript:void(0)";
                anchor.onclick = () => openBrowser(ad.url);

                const img = document.createElement('img');
                img.classList.add('w-100');
                img.src = ad.path;

                anchor.appendChild(img);
                li.appendChild(anchor);
                listContainer.appendChild(li);
            });

        // Init Splide if not already initialized
        new Splide('#ad-slider', {
            type: 'loop', // Vòng lặp slider
            perPage: 1, // Hiển thị 1 slide mỗi lần
            autoplay: true, // Tự động chạy
            interval: 5000, // Thời gian chuyển slide (3 giây)
            pauseOnHover: true, // Tạm dừng khi hover
            arrows: true, // Hiển thị nút điều hướng
            pagination: true, // Hiển thị chấm điều hướng
        }).mount();

    } catch (err) {
        console.error('Lỗi khi tải quảng cáo:', err);
        const container = document.querySelector('.ads');
        container.innerHTML = ''; // remove Splide structure

        const fallbackImg = document.createElement('img');
        fallbackImg.classList.add('w-100');
        fallbackImg.src = 'assets/ads.png';

        container.appendChild(fallbackImg);


    }
}

function openBrowser(url) {
    shell.openExternal(url);

}


// xử lý license 
function getMachineId() {
    try {
        return machineIdSync();
    } catch {
        return null;
    }
}



async function checkEnterLicense(license) {
    const machine_id = getMachineId();

    try {
        const res = await axios.post(`${DOMAIN}/api/license-key/verify`, {
            license,
            machine_id,
        });

        return res.data;
    } catch (err) {
        console.error('Lỗi khi gọi API:', err.message);
        return { valid: false, license_type: 'free' };
    }
}


document.getElementById('submit-license').addEventListener('click', async () => {
    const license = document.getElementById('license-input').value.trim();

    if (!license) {
        alert("Vui lòng nhập license!");
        return;
    }

    const result = await checkEnterLicense(license);

    if (result.valid) {
        ipcRenderer.send('save-license', license);
        alert('License hợp lệ! Vui lòng khởi động lại ứng dụng.');
    } else {
        alert('License không hợp lệ.');
    }
});
let licenseTypeGlobal = 'free';
async function getLicenseInfoFromMain() {
    const { licenseType, expiredDate } = await ipcRenderer.invoke('get-license-info');
    console.log('License Type:', licenseType);
    console.log('Expired Date:', expiredDate);

    if (licenseType === 'free') {
        document.getElementById('license-info').innerHTML = 'Phiên bản miễn phí';
    } else {
        licenseTypeGlobal = 'vip'
        document.getElementById('license-info').innerHTML = `Phiên bản VIP`;
        if (expiredDate) {
            document.getElementById('license-info').innerHTML += `, hết hạn vào ${expiredDate}`;
        }


        document.getElementById('ads-premium').remove();
        document.querySelector('.enter-key').remove();
    }

    loadFiles('effect');

}

getLicenseInfoFromMain()




