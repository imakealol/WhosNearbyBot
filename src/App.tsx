// App.tsx — Main React SPA component for Who's Nearby
// Covers: initialization, profile setup, grid/map views, filters, payments,
// profile card, games menu, footer navigation.

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { createClient } from '@supabase/supabase-js';
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';

import bustaIcon from './assets/Bustagames.jpg';
import tonflipIcon from './assets/Tonflip.jpg';
import photifyIcon from './assets/Photify.jpg';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        ready?: () => void;
        expand?: () => void;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
        showAlert?: (message: string) => void;
        openInvoice?: (url: string, callback?: (status: string) => void) => void;
        CloudStorage?: {
          setItem?: (key: string, value: string, callback?: (error?: string) => void) => void;
          getItem?: (key: string, callback?: (error?: string, value?: string) => void) => void;
        };
      };
    };
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const PAYMENT_WORKER_URL = import.meta.env.VITE_PAYMENT_WORKER_URL || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type LangKey = 'en' | 'zh-CN' | 'zh-TW' | 'ja' | 'ko' | 'ru';

const translations: Record<LangKey, Record<string, string>> = {
  'en': {
    loading: 'Loading app...', locationRequired: 'Location Access Required', locationMessage: "Location permission is mandatory to use Who's Nearby. Please enable location access in your browser or Telegram settings and restart the app.", accessDenied: 'Access Denied', underageMessage: 'The app is for adults only. Access has been locked for this account due to age restrictions.', completeProfile: 'Complete Your Profile', profileWarning: 'Warning: This cannot be changed in the future. Information entered here affects who you can see and interact with.', dob: 'Date of Birth:', imA: "I'm a", seeking: 'seeking', man: 'man', woman: 'woman', nonBinary: 'non-binary', men: 'men', women: 'women', everyone: 'everyone', height: 'Height:', selectHeight: 'Select height', weight: 'Weight:', selectWeight: 'Select weight', tapToChange: 'tap to change your preference:', mode: 'Mode:', browsingOnly: 'Browsing only - You cannot send not receive private message from others', onlineOnly: 'Online only - You are visible on grid but not on map, map is inaccessible', meetUp: 'Meet up - You are visible on grid and map', saveProfile: 'Save Profile & Continue', whosNearby: "Who's Nearby", filter: 'Filter', refresh: 'Refresh', grid: 'Grid', chat: 'Chat', map: 'Map', wallet: 'Wallet', filterUsers: 'Filter Users', ageRange: 'Age Range', preferenceMatcher: 'Preference Matcher', rolePreference: 'Role Preference', safetyPreference: 'Safety Preference', playstylePreference: 'Playstyle Preference', groupSize: 'Group Size', applyFilters: 'Apply Filters', ageHidden: 'Age Hidden (Click to Show)', ageShown: 'Age Shown (Click to Hide)', expires: 'Expires:', sendMessage: 'Send Message', unlockPreference: 'Change Profile & Preferences', iGotStuff: 'I got stuff', unlockPreferencePrompt: 'Changing your profile/preferences requires a one-time payment of 1000 Telegram Stars. Proceed to payment?', invisiblePrompt: 'Going invisible requires a 30-day subscription for 3000 Telegram Stars. Proceed to payment?', hideAgePrompt: 'Hiding your age for 30 days costs 1000 Telegram Stars. Proceed to payment?', filterSubPrompt: 'Customizing this filter requires a subscription. Proceed to payment?', paymentCancelled: 'Payment was cancelled or failed.', errorSaving: 'Error saving profile:', fillAll: 'Please fill in all required questions to continue.',
    'Versatile': 'Versatile', 'Top': 'Top', 'Bottom': 'Bottom', 'Side': 'Side', 'VT': 'Vers / Top', 'VB': 'Vers / Bottom',
    'Safe': 'Safe (Condoms)', 'Raw': 'Raw (Bareback)',
    'Clean': 'Clean (No Drugs)', 'Party': 'Party (Chemsex)', 'Party✓': 'Party✓',
    '1on1_setup': '1-on-1 (only)', 'group_setup': 'group (only)', 'DoesntMatter_setup': "Doesn't matter",
    '1on1': '1-on-1', 'group': 'group', 'DoesntMatter': "Doesn't matter",
    'Host': 'Host', 'Travel': 'Travel', 'Off': 'Off', 'Anywhere': 'Anywhere', 'Role': 'Role', 'Safety': 'Safety', 'Playstyle': 'Playstyle', 'How Many': 'How Many', 'Where': 'Where',
    you: 'You', away: 'away', online: 'Online', offline: 'Offline',
    mAgo: '{n}m ago', hAgo: '{n}h ago', dAgo: '{n}d ago',
    m2m: 'M2M', admin: 'Admin', unsubscribed: 'Unsubscribed',
    subscribedUntil: 'Subscribed until {d}', expired: 'Expired',
    privateNote: 'Private note', notePlaceholder: 'Private note (100 chars max)',
    forceReset: 'Force reset', gamesApps: 'Games & Apps',
    selectedUser: 'Selected user: {n}', profileReset: 'Profile reset.', resetFailed: 'Reset failed.',
    forceResetConfirm: 'Force reset profile of {n}?',
    resetAllUnderage: 'Reset all underage', resetAllUnderageConfirm: 'Reset ALL underage profiles?'
  },
  'zh-CN': {
    loading: '正在加载应用...', locationRequired: '需要位置权限', locationMessage: '使用"附近"功能必须获得位置权限。请在浏览器或 Telegram 设置中启用位置访问并重新启动应用。', accessDenied: '拒绝访问', underageMessage: '本应用仅限成年人使用。由于年龄限制，该账户已被锁定。', completeProfile: '完善您的个人资料', profileWarning: '警告：此信息将来无法更改。此处填写的内容会影响您可以看到和互动的用户。', dob: '出生日期：', imA: '我是', seeking: '寻找', man: '男性', woman: '女性', nonBinary: '非二元性别', men: '男性', women: '女性', everyone: '所有人', height: '身高：', selectHeight: '选择身高', weight: '体重：', selectWeight: '选择体重', tapToChange: '点击更改您的偏好：', mode: '模式：', browsingOnly: '仅浏览', onlineOnly: '仅在线', meetUp: '约会中', saveProfile: '保存资料并继续', whosNearby: '附近的人', filter: '筛选', refresh: '刷新', grid: '网格', chat: '聊天', map: '地图', wallet: '钱包', filterUsers: '筛选用户', ageRange: '年龄范围', preferenceMatcher: '偏好匹配器', rolePreference: '角色偏好', safetyPreference: '安全偏好', playstylePreference: '游戏风格偏好', groupSize: '群组人数', applyFilters: '应用筛选', ageHidden: '年龄已隐藏', ageShown: '年龄已显示', expires: '到期时间：', sendMessage: '发送消息', unlockPreference: '更改资料与偏好', iGotStuff: '我有货', unlockPreferencePrompt: '更改个人资料与偏好需要支付 1000 Telegram Stars。是否继续支付？', invisiblePrompt: '隐身需要订阅 30 天，费用为 3000 Telegram Stars。是否继续支付？', hideAgePrompt: '隐藏年龄需要订阅 30 天，费用为 1000 Telegram Stars。是否继续支付？', filterSubPrompt: '自定义此筛选条件需要订阅。是否继续支付？', paymentCancelled: '支付已取消或失败。', errorSaving: '保存资料出错：', fillAll: '请填写所有必填问题以继续。',
    'Versatile': '0.5 (可攻可受)', 'Top': '1 (攻)', 'Bottom': '0 (受)', 'Side': 'Side (边缘)', 'VT': '可攻可受 / 攻', 'VB': '可攻可受 / 受',
    'Safe': 'Safe (戴套)', 'Raw': 'Raw (无套)',
    'Clean': 'Clean (无药)', 'Party': 'Party (嗨药)', 'Party✓': 'Party✓',
    '1on1_setup': '单对单 (仅限1on1)', 'group_setup': '群组 (仅限群组)', 'DoesntMatter_setup': '无所谓',
    '1on1': '单对单', 'group': '群组', 'DoesntMatter': '无所谓',
    'Host': '提供场地 (Host)', 'Travel': '上门 (Travel)', 'Off': '关闭', 'Anywhere': '任意', 'Role': '角色', 'Safety': '安全', 'Playstyle': '风格', 'How Many': '人数', 'Where': '地点',
    you: '你', away: '远', online: '在线', offline: '离线',
    mAgo: '{n}分钟前', hAgo: '{n}小时前', dAgo: '{n}天前',
    m2m: '男找男 (M2M)', admin: '管理员', unsubscribed: '未订阅',
    subscribedUntil: '已订阅至 {d}', expired: '已过期',
    privateNote: '私密备注', notePlaceholder: '私密备注 (最多100字)',
    forceReset: '强制重置', gamesApps: '游戏和应用',
    selectedUser: '已选中用户: {n}', profileReset: '资料已重置。', resetFailed: '重置失败。',
    forceResetConfirm: '强制重置 {n} 的资料？'
  },
  'zh-TW': {
    loading: '正在載入應用程式...', locationRequired: '需要位置權限', locationMessage: '使用「附近」功能必須獲得位置權限。請在瀏覽器或 Telegram 設定中啟用位置存取並重新啟動應用程式。', accessDenied: '存取被拒', underageMessage: '本應用程式僅限成年人使用。由於年齡限制，該帳戶已被鎖定。', completeProfile: '完善您的個人資料', profileWarning: '警告：此資訊未來無法更改。此處填寫的內容會影響您可以看到和互動的使用者。', dob: '出生日期：', imA: '我是', seeking: '尋找', man: '男性', woman: '女性', nonBinary: '非二元性別', men: '男性', women: '女性', everyone: '所有人', height: '身高：', selectHeight: '選擇身高', weight: '體重：', selectWeight: '選擇體重', tapToChange: '點擊更改您的偏好：', mode: '模式：', browsingOnly: '僅瀏覽', onlineOnly: '僅線上', meetUp: '見面中', saveProfile: '儲存資料並繼續', whosNearby: '附近的人', filter: '篩選', refresh: '重新整理', grid: '網格', chat: '聊天', map: '地圖', wallet: '錢包', filterUsers: '篩選使用者', ageRange: '年齡範圍', preferenceMatcher: '偏好匹配器', rolePreference: '角色偏好', safetyPreference: '安全偏好', playstylePreference: '風格偏好', groupSize: '群組人數', applyFilters: '套用篩選', ageHidden: '年齡已隱藏', ageShown: '年齡已顯示', expires: '到期時間：', sendMessage: '傳送訊息', unlockPreference: '更改資料與偏好', iGotStuff: '我有貨', unlockPreferencePrompt: '更改個人資料與偏好需要支付 1000 Telegram Stars。是否繼續支付？', invisiblePrompt: '隱身需要訂閱 30 天，費用為 3000 Telegram Stars。是否繼續支付？', hideAgePrompt: '隱藏年齡需要訂閱 30 天，費用為 1000 Telegram Stars。是否繼續支付？', filterSubPrompt: '自訂此篩選條件需要訂閱。是否繼續支付？', paymentCancelled: '付款已取消或失敗。', errorSaving: '儲存資料出錯：', fillAll: '請填寫所有必填問題以繼續。',
    'Versatile': '0.5 (不分)', 'Top': '1 (頂)', 'Bottom': '0 (底)', 'Side': 'Side (邊緣)', 'VT': '不分 / 頂', 'VB': '不分 / 底',
    'Safe': 'Safe (戴套)', 'Raw': 'Raw (無套)',
    'Clean': 'Clean (無藥)', 'Party': 'Party (嗨藥/煙)', 'Party✓': 'Party✓',
    '1on1_setup': '單對單 (僅限1on1)', 'group_setup': '群組 (僅限群組)', 'DoesntMatter_setup': '無所謂',
    '1on1': '單對單', 'group': '群組', 'DoesntMatter': '無所謂',
    'Host': '提供場地 (Host)', 'Travel': '上門 (Travel)', 'Off': '關閉', 'Anywhere': '任意', 'Role': '角色', 'Safety': '安全', 'Playstyle': '風格', 'How Many': '人數', 'Where': '地點',
    you: '你', away: '遠', online: '在線', offline: '離線',
    mAgo: '{n}分鐘前', hAgo: '{n}小時前', dAgo: '{n}天前',
    m2m: '男找男 (M2M)', admin: '管理員', unsubscribed: '未訂閱',
    subscribedUntil: '已訂閱至 {d}', expired: '已過期',
    privateNote: '私密備註', notePlaceholder: '私密備註 (最多100字)',
    forceReset: '強制重置', gamesApps: '遊戲和應用',
    selectedUser: '已選中用戶: {n}', profileReset: '資料已重置。', resetFailed: '重置失敗。',
    forceResetConfirm: '強制重置 {n} 的資料？'
  },
  'ja': {
    loading: 'アプリを読み込んでいます...', locationRequired: '位置情報のアクセスが必要です', locationMessage: '位置情報の許可が必須です。ブラウザまたは Telegram の設定で位置情報を有効にし、アプリを再起動してください。', accessDenied: 'アクセスが拒否されました', underageMessage: 'このアプリは成人向けです。年齢制限により、このアカウントのアクセスはロックされました。', completeProfile: 'プロフィールを完成させる', profileWarning: '警告：これは後から変更できません。ここで入力した情報は、表示・交流できる相手に影響します。', dob: '生年月日：', imA: '私は', seeking: '探しています：', man: '男性', woman: '女性', nonBinary: 'ノンバイナリー', men: '男性', women: '女性', everyone: 'すべての人', height: '身長：', selectHeight: '身長を選択', weight: '体重：', selectWeight: '体重を選択', tapToChange: 'タップして好みを変更：', mode: 'モード：', browsingOnly: '閲覧のみ', onlineOnly: 'オンラインのみ', meetUp: 'ミートアップ', saveProfile: 'プロフィールを保存して続ける', whosNearby: '近くの人', filter: 'フィルター', refresh: '更新', grid: 'グリッド', chat: 'チャット', map: 'マップ', wallet: 'ウォレット', filterUsers: 'ユーザーをフィルター', ageRange: '年齢層', preferenceMatcher: '好みマッチング', rolePreference: 'ロールの好み', safetyPreference: '安全の好み', playstylePreference: 'プレイスタイルの好み', groupSize: 'グループサイズ', applyFilters: 'フィルターを適用', ageHidden: '年齢非表示', ageShown: '年齢表示', expires: '有効期限：', sendMessage: 'メッセージを送る', unlockPreference: 'プロフィールと好みを変更', iGotStuff: '持ってるよ', unlockPreferencePrompt: 'プロフィールの変更には1000 Starsが必要です。', invisiblePrompt: '透明化には3000 Starsが必要です。', hideAgePrompt: '年齢非表示には1000 Starsが必要です。', filterSubPrompt: 'フィルターのカスタマイズにはサブスクリプションが必要です。', paymentCancelled: '支払いがキャンセルされました。', errorSaving: 'エラー：', fillAll: 'すべての必須項目を入力してください。',
    'Versatile': 'リバ (Vers)', 'Top': 'タチ (Top)', 'Bottom': 'ネコ (Btm)', 'Side': 'サイド (Side)', 'VT': 'リバ/タチ (VT)', 'VB': 'リバ/ネコ (VB)',
    'Safe': 'ゴムあり (Safe)', 'Raw': '生/中出し (Raw)',
    'Clean': 'シラフ (Clean)', 'Party': 'ケミ (Party)', 'Party✓': 'Party✓',
    '1on1_setup': '1対1 (のみ)', 'group_setup': 'グループ (のみ)', 'DoesntMatter_setup': 'こだわらない',
    '1on1': '1対1', 'group': 'グループ', 'DoesntMatter': 'こだわらない',
    'Host': '部屋あり (Host)', 'Travel': '訪問 (Travel)', 'Off': 'オフ', 'Anywhere': 'どこでも', 'Role': '役割', 'Safety': '安全', 'Playstyle': 'スタイル', 'How Many': '人数', 'Where': '場所',
    you: 'あなた', away: '先', online: 'オンライン', offline: 'オフライン',
    mAgo: '{n}分前', hAgo: '{n}時間前', dAgo: '{n}日前',
    m2m: '男×男 (M2M)', admin: '管理者', unsubscribed: '未購読',
    subscribedUntil: '購読期限: {d}', expired: '期限切れ',
    privateNote: 'プライベートメモ', notePlaceholder: 'プライベートメモ (最大100文字)',
    forceReset: '強制リセット', gamesApps: 'ゲーム&アプリ',
    selectedUser: '選択したユーザー: {n}', profileReset: 'プロフィールをリセットしました。', resetFailed: 'リセットに失敗しました。',
    forceResetConfirm: '{n} のプロフィールを強制リセットしますか？'
  },
  'ko': {
    loading: '앱 로딩 중...', locationRequired: '위치 접근 권한 필요', locationMessage: '위치 권한이 필수입니다. 브라우저 또는 Telegram 설정에서 위치 접근을 허용하고 앱을 다시 시작하세요.', accessDenied: '접근 거부됨', underageMessage: '이 앱은 성인 전용입니다. 연령 제한으로 이 계정은 잠겼습니다.', completeProfile: '프로필 완성하기', profileWarning: '경고: 이는 나중에 변경할 수 없습니다. 여기 입력한 정보는 볼 수 있고 상호작용할 수 있는 상대에게 영향을 줍니다.', dob: '생년월일:', imA: '나는', seeking: '찾는 대상:', man: '남성', woman: '여성', nonBinary: '논바이너리', men: '남성', women: '여성', everyone: '모두', height: '키:', selectHeight: '키 선택', weight: '체중:', selectWeight: '체중 선택', tapToChange: '탭하여 선호도 변경:', mode: '모드:', browsingOnly: '브라우징 전용', onlineOnly: '온라인 전용', meetUp: '만남', saveProfile: '프로필 저장 및 계속', whosNearby: '내 주변', filter: '필터', refresh: '새로고침', grid: '그리드', chat: '채팅', map: '지도', wallet: '지갑', filterUsers: '사용자 필터', ageRange: '연령대', preferenceMatcher: '취향 매칭', rolePreference: '포지션 선호', safetyPreference: '안전 선호', playstylePreference: '플레이스타일 선호', groupSize: '그룹 인원', applyFilters: '필터 적용', ageHidden: '나이 숨김', ageShown: '나이 표시', expires: '만료일:', sendMessage: '메시지 보내기', unlockPreference: '프로필 변경', iGotStuff: '나 있음', unlockPreferencePrompt: '프로필 변경 1000 Stars 결제?', invisiblePrompt: '숨김 모드 3000 Stars 결제?', hideAgePrompt: '나이 숨기기 1000 Stars 결제?', filterSubPrompt: '필터 변경 구독 필요.', paymentCancelled: '결제 취소됨.', errorSaving: '오류:', fillAll: '필수 항목을 입력해주세요.',
    'Versatile': '올 (Vers)', 'Top': '탑 (Top)', 'Bottom': '바텀 (Btm)', 'Side': '사이드 (Side)', 'VT': '버스/탑 (VT)', 'VB': '버스/바텀 (VB)',
    'Safe': '안전/콘돔 (Safe)', 'Raw': '노콘 (Raw)',
    'Clean': '노약 (Clean)', 'Party': '파티/약 (Party)', 'Party✓': 'Party✓',
    '1on1_setup': '1대1 (전용)', 'group_setup': '그룹 (전용)', 'DoesntMatter_setup': '상관없음',
    '1on1': '1대1', 'group': '그룹', 'DoesntMatter': '상관없음',
    'Host': '호스트 (방 있음)', 'Travel': '이동가능 (Travel)', 'Off': '꺼짐', 'Anywhere': '상관없음', 'Role': '포지션', 'Safety': '안전', 'Playstyle': '스타일', 'How Many': '인원', 'Where': '장소',
    you: '나', away: '거리', online: '온라인', offline: '오프라인',
    mAgo: '{n}분 전', hAgo: '{n}시간 전', dAgo: '{n}일 전',
    m2m: '남↔남 (M2M)', admin: '관리자', unsubscribed: '미구독',
    subscribedUntil: '구독 만료: {d}', expired: '만료됨',
    privateNote: '개인 메모', notePlaceholder: '개인 메모 (최대 100자)',
    forceReset: '강제 초기화', gamesApps: '게임 & 앱',
    selectedUser: '선택한 사용자: {n}', profileReset: '프로필이 초기화되었습니다.', resetFailed: '초기화에 실패했습니다.',
    forceResetConfirm: '{n} 님의 프로필을 강제 초기화할까요?'
  },
  'ru': {
    loading: 'Загрузка...', locationRequired: 'Требуется геолокация', locationMessage: 'Разрешение на геолокацию обязательно. Включите доступ к местоположению в браузере или настройках Telegram и перезапустите приложение.', accessDenied: 'Доступ запрещен', underageMessage: 'Приложение только для взрослых. Доступ к этому аккаунту заблокирован из-за возрастных ограничений.', completeProfile: 'Заполните профиль', profileWarning: 'Предупреждение: это нельзя изменить. Введённые здесь данные влияют на то, кого вы видите и с кем взаимодействуете.', dob: 'Дата рождения:', imA: 'Я', seeking: 'ищу', man: 'мужчину', woman: 'женщину', nonBinary: 'небинарную', men: 'мужчин', women: 'женщин', everyone: 'всех', height: 'Рост:', selectHeight: 'Выберите рост', weight: 'Вес:', selectWeight: 'Выберите вес', tapToChange: 'нажмите, чтобы изменить:', mode: 'Режим:', browsingOnly: 'Только просмотр', onlineOnly: 'Только онлайн', meetUp: 'Встреча', saveProfile: 'Сохранить', whosNearby: 'Рядом', filter: 'Фильтр', refresh: 'Обновить', grid: 'Сетка', chat: 'Чат', map: 'Карта', wallet: 'Кошелек', filterUsers: 'Фильтры', ageRange: 'Возраст', preferenceMatcher: 'Подбор по предпочтениям', rolePreference: 'Роль', safetyPreference: 'Безопасность', playstylePreference: 'Стиль', groupSize: 'Размер группы', applyFilters: 'Применить', ageHidden: 'Возраст скрыт', ageShown: 'Возраст виден', expires: 'Истекает:', sendMessage: 'Сообщение', unlockPreference: 'Изменить профиль', iGotStuff: 'У меня есть стафф', unlockPreferencePrompt: 'Изменить профиль за 1000 Stars?', invisiblePrompt: 'Невидимка за 3000 Stars?', hideAgePrompt: 'Скрыть возраст за 1000 Stars?', filterSubPrompt: 'Требуется подписка на фильтры.', paymentCancelled: 'Оплата отменена.', errorSaving: 'Ошибка:', fillAll: 'Заполните все поля.',
    'Versatile': 'Универсал (Vers)', 'Top': 'Актив (Top)', 'Bottom': 'Пассив (Btm)', 'Side': 'Без пенетрации (Side)', 'VT': 'Универсал/Актив (VT)', 'VB': 'Универсал/Пассив (VB)',
    'Safe': 'С резинкой (Safe)', 'Raw': 'Без резинки (Raw)',
    'Clean': 'Без наркотиков (Clean)', 'Party': 'Химсекс (Party)', 'Party✓': 'Party✓',
    '1on1_setup': '1 на 1 (только)', 'group_setup': 'группа (только)', 'DoesntMatter_setup': 'Неважно',
    '1on1': '1 на 1', 'group': 'группа', 'DoesntMatter': 'Неважно',
    'Host': 'Принимаю (Host)', 'Travel': 'Приеду (Travel)', 'Off': 'Выкл', 'Anywhere': 'Везде', 'Role': 'Роль', 'Safety': 'Безопасность', 'Playstyle': 'Стиль', 'How Many': 'Сколько', 'Where': 'Где',
    you: 'Вы', away: 'от вас', online: 'Онлайн', offline: 'Офлайн',
    mAgo: '{n} мин назад', hAgo: '{n} ч назад', dAgo: '{n} дн назад',
    m2m: 'М+М (M2M)', admin: 'Админ', unsubscribed: 'Без подписки',
    subscribedUntil: 'Подписка до {d}', expired: 'Истекла',
    privateNote: 'Личная заметка', notePlaceholder: 'Личная заметка (макс. 100 симв.)',
    forceReset: 'Принуд. сброс', gamesApps: 'Игры и приложения',
    selectedUser: 'Выбран пользователь: {n}', profileReset: 'Профиль сброшен.', resetFailed: 'Ошибка сброса.',
    forceResetConfirm: 'Сбросить профиль {n}?'
  }
};

interface UserProfile {
  id: string;
  name: string;
  username?: string;
  avatar: string;
  lat: number | null;
  lng: number | null;
  last_seen: string | null;
  gender?: string | null;
  seeking?: string | null;
  dob?: string | null;
  height?: string | null;
  weight?: string | null;
  role_pref?: string | null;
  safety_pref?: string | null;
  playstyle_pref?: string | null;
  where_pref?: string | null;
  how_many_pref?: string | null;
  non_man_mode?: string | null;
  is_underage?: boolean;
  hide_age?: boolean;
  grid_visible?: boolean;
  map_visible?: boolean;
  distance?: number;
  hide_age_expiry?: string | null;
  invisible_expiry?: string | null;
  filter_sub_expiry?: string | null;
}

const formatDistanceBigUnit = (meters?: number) => {
  if (meters === undefined || meters === null) return '0m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
};

const formatTagText = (str: string) => {
  if (!str) return '';
  return str.replace(/\s*[(（][^)）]*[)）]/g, '').trim();
};

const calculateAge = (dobString?: string | null) => {
  if (!dobString) return null;
  try {
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
};

const parseHeightMeters = (height?: string | null): number | null => {
  if (!height) return null;
  const m = String(height).match(/(\d+(?:\.\d+)?)\s*m/i);
  if (m) {
    const v = parseFloat(m[1]);
    return v >= 0.5 && v <= 3 ? v : null;
  }
  const cm = String(height).match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (cm) {
    const v = parseFloat(cm[1]);
    return v >= 50 && v <= 300 ? v / 100 : null;
  }
  return null;
};

const getZodiacSignEmoji = (dobString?: string | null) => {
  if (!dobString) return '';
  try {
    const date = new Date(dobString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return '♈';
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return '♉';
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return '♊';
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return '♋';
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return '♌';
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return '♍';
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return '♎';
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return '♏';
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return '♐';
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return '♑';
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return '♒';
    return '♓';
  } catch {
    return '';
  }
};

const formatLastSeenBigUnit = (isoString?: string | null) => {
  if (!isoString) return 'offline';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'online';
    if (diffMins < 60) return `mAgo:${diffMins}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hAgo:${diffHours}`;
    return `dAgo:${Math.floor(diffHours / 24)}`;
  } catch {
    return 'offline';
  }
};

// Render a formatLastSeenBigUnit token with the current language
const renderLastSeenBigUnit = (token: string, t: (key: string) => string) => {
  if (token.startsWith('mAgo:')) return t('mAgo').replace('{n}', token.slice(5));
  if (token.startsWith('hAgo:')) return t('hAgo').replace('{n}', token.slice(5));
  if (token.startsWith('dAgo:')) return t('dAgo').replace('{n}', token.slice(5));
  return t(token);
};

const isOnlineWithin15Min = (isoString?: string | null) => {
  if (!isoString) return false;
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = diffMs / 60000;
    return diffMins <= 15 && diffMins >= 0;
  } catch {
    return false;
  }
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.invalidateSize();
      map.setView(center, 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

// Fallback tile source: if the CartoDB dark tiles fail (e.g. rate-limited with
// an "API key required" error tile), swap to the free OSM standard tiles.
const FALLBACK_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let tileFallbackUsed = false;
function TileFallbackController() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const onTileError = () => {
      if (tileFallbackUsed) return;
      tileFallbackUsed = true;
      map.eachLayer((layer: any) => {
        if (layer instanceof L.TileLayer) { map.removeLayer(layer); }
      });
      L.tileLayer(FALLBACK_TILE_URL, { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    };
    map.on('tileerror', onTileError);
    return () => { map.off('tileerror', onTileError); };
  }, [map]);
  return null;
}

const createProfileIcon = (user: UserProfile, isEnabled: boolean, isSelf: boolean, isOnline: boolean) => {
  let innerHtml = '';
  if (user.avatar) {
    innerHtml = `<img src="${user.avatar}" style="width: 100%; height: 100%; object-fit: cover;" />`;
  } else {
    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    innerHtml = `<div style="width: 100%; height: 100%; background-color: #0088cc; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${initial}</div>`;
  }
  const opacity = isEnabled ? '1' : '0.3';
  const filter = isEnabled ? 'none' : 'grayscale(100%)';
  const borderColor = isSelf ? '#00ffff' : (isEnabled ? '#007bff' : '#555');
  const greenDotHtml = isOnline
    ? `<div style="position: absolute; top: 0; right: 0; width: 10px; height: 10px; background-color: #4ade80; border-radius: 50%; border: 2px solid #121212; z-index: 10;"></div>`
    : '';
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="position: relative; width: 36px; height: 36px; border-radius: 50%; overflow: visible; border: 3px solid ${borderColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.6); background-color: #222; opacity: ${opacity}; filter: ${filter}; display: flex; align-items: center; justify-content: center;"><div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;">${innerHtml}</div>${greenDotHtml}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

export default function App() {
  const [lang, setLang] = useState<LangKey>('en');
  const t = (key: string) => translations[lang]?.[key] || translations['en'][key] || key;
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 22.3193, lng: 114.1694 });
  const [isReady, setIsReady] = useState<boolean>(false);
  const [showProfileSetup, setShowProfileSetup] = useState<boolean>(false);
  const [isUnderageLocked, setIsUnderageLocked] = useState<boolean>(false);
  const [isLocationDenied, setIsLocationDenied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showStuffBubble, setShowStuffBubble] = useState<boolean>(false);
  const [hasFilterSub, setHasFilterSub] = useState<boolean>(false);
  const [filterSubUntil, setFilterSubUntil] = useState<number>(0);
  const filterSubUntilRef = useRef<number>(0);
  useEffect(() => { filterSubUntilRef.current = filterSubUntil; }, [filterSubUntil]);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const isWalletConnected = !!wallet;

  const handleWalletClick = async () => {
    if (isWalletConnected) {
      try { await tonConnectUI.disconnect(); } catch (err) { console.error('Wallet disconnect error:', err); }
      return;
    }
    try { await tonConnectUI.openSingleWalletModal('telegram-wallet'); } catch (err) { console.error('Wallet connect error:', err); }
  };

  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [filterAgeOn, setFilterAgeOn] = useState<boolean>(false);
  const [filterAgeMin, setFilterAgeMin] = useState<number>(18);
  const [filterAgeMax, setFilterAgeMax] = useState<number>(60);
  const [filterHeightOn, setFilterHeightOn] = useState<boolean>(false);
  const [filterHeightMin, setFilterHeightMin] = useState<number>(140);
  const [filterHeightMax, setFilterHeightMax] = useState<number>(200);
  const [filterPrefMatcherOn, setFilterPrefMatcherOn] = useState<boolean>(true);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [showNoteBox, setShowNoteBox] = useState<boolean>(false);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [showProfileEditModal, setShowProfileEditModal] = useState<boolean>(false);
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState<boolean>(false);
  const [dob, setDob] = useState<string>('');
  const [gender, setGender] = useState<string>('man');
  const [seeking, setSeeking] = useState<string>('women');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [rolePref, setRolePref] = useState<string>('Versatile');
  const [safetyPref, setSafetyPref] = useState<string>('Safe');
  const [playstylePref, setPlaystylePref] = useState<string>('Clean');
  const [howManyPref, setHowManyPref] = useState<string>('DoesntMatter');
  const [wherePref, setWherePref] = useState<string | null>(null);
  const [nonManMode, setNonManMode] = useState<string>('Meet up - You are visible on grid and map');
  const [hideAge, setHideAge] = useState<boolean>(false);
  const [hideAgeExpiry, setHideAgeExpiry] = useState<string | null>(null);
  const [invisibleExpiry, setInvisibleExpiry] = useState<string | null>(null);
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [mapVisible, setMapVisible] = useState<boolean>(false);
  const [filterRoleVal, setFilterRoleVal] = useState<string | null>(null);
  const [filterSafetyVal, setFilterSafetyVal] = useState<string | null>(null);
  const [filterPlaystyleVal, setFilterPlaystyleVal] = useState<string | null>(null);
  const [filterHowManyVal, setFilterHowManyVal] = useState<string | null>(null);
  const [filterWhereVal, setFilterWhereVal] = useState<string | null>(null);

  const roleCycleOptions = ['Versatile', 'Top', 'Bottom', 'Side'];
  const safetyCycleOptions = ['Safe', 'Raw'];
  const howManyCycleOptions = ['1on1', 'DoesntMatter'];
  const whereCycleOptions = ['Host', 'Travel', null];
  const filterRoleCycleOptions = ['Top', 'VT', 'Versatile', 'VB', 'Bottom', 'Side', 'Off'];
  const filterSafetyCycleOptions = ['Safe', 'Raw', 'Off'];
  const filterPlaystyleCycleOptions = ['Clean', 'Party', 'Off'];
  const filterHowManyCycleOptions = ['1on1', 'DoesntMatter', 'Off'];
  const filterWhereCycleOptions = ['Host', 'Travel', 'Off'];

  const cycleNext = (current: string, options: string[]) => {
    const idx = options.indexOf(current);
    if (idx === -1 || idx === options.length - 1) return options[0];
    return options[idx + 1];
  };
  const cycleWhere = (current: string | null, options: (string | null)[]) => {
    const idx = options.indexOf(current);
    if (idx === -1 || idx === options.length - 1) return options[0];
    return options[idx + 1];
  };

  const heightOptions = [];
  for (let cm = 100; cm <= 300; cm += 5) {
    const totalInches = Math.round(cm / 2.54);
    const ft = Math.floor(totalInches / 12);
    const inch = totalInches % 12;
    heightOptions.push(`${cm}cm (${ft}ft ${inch}in)`);
  }
  const weightOptions = [];
  for (let kg = 35; kg <= 160; kg += 1) {
    const lbs = Math.round(kg * 2.20462);
    weightOptions.push(`${kg}kg (${lbs}lbs)`);
  }

  const getActiveBotKey = () => {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || (window.location.search.includes('mode=gay') ? 'gaymode' : '');
    return startParam === 'gaymode' ? 'botA' : 'botB';
  };

  const applyDefaultFiltersFromPreferences = (pRole: string, pSafety: string, pPlaystyle: string, pHowMany: string) => {
    if (pRole === 'Top') setFilterRoleVal('Bottom');
    else if (pRole === 'Bottom') setFilterRoleVal('Top');
    else if (pRole === 'Side') setFilterRoleVal('Side');
    else setFilterRoleVal(null);
    setFilterSafetyVal(pSafety);
    if (pHowMany === '1on1') setFilterHowManyVal('1on1');
    else setFilterHowManyVal(null);
    if (pPlaystyle === 'Party' || pPlaystyle === 'Party✓') setFilterPlaystyleVal('Party');
    else setFilterPlaystyleVal('Clean');
  };

  const fetchUsersData = async (lat: number, lng: number, currentUserId: string, userIsAdmin: boolean) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('get_nearby_users', {
      p_lat: lat, p_lng: lng, p_radius_meters: 50000,
      p_requesting_user_id: currentUserId, p_is_admin: userIsAdmin
    });
    if (!error && data && Array.isArray(data)) {
      const processed = data.map((u: any) => ({
        id: u.id || 'unknown', name: u.name || (u.username ? '@'+u.username : 'Anonymous'), username: u.username || '',
        avatar: u.avatar || '', lat: typeof u.lat === 'number' ? u.lat : lat,
        lng: typeof u.lng === 'number' ? u.lng : lng,
        last_seen: u.last_seen || new Date().toISOString(), gender: u.gender || null,
        seeking: u.seeking || null, dob: u.dob || null, height: u.height || null,
        weight: u.weight || null, role_pref: u.role_pref || null, safety_pref: u.safety_pref || null,
        playstyle_pref: u.playstyle_pref || null, where_pref: u.where_pref || null,
        how_many_pref: u.how_many_pref || null, non_man_mode: u.non_man_mode || null,
        is_underage: u.is_underage || false, hide_age: u.hide_age || false,
        grid_visible: u.grid_visible ?? true, map_visible: u.map_visible ?? false,
        distance: Math.round(u.distance),
        hide_age_expiry: u.hide_age_expiry || null, invisible_expiry: u.invisible_expiry || null,
        filter_sub_expiry: u.filter_sub_expiry || null,
      })).sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return (a.distance || 0) - (b.distance || 0);
      });
      setUsers(processed);
    } else if (error) { console.error("Error fetching nearby users:", error); }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready?.();
          window.Telegram.WebApp.expand?.();
        }
        let tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        let startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || (window.location.search.includes('mode=gay') ? 'gaymode' : '');
        if (!tgUser) {
          await new Promise((res) => setTimeout(res, 300));
          tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
          startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || startParam || (window.location.search.includes('mode=gay') ? 'gaymode' : '');
        }
        const tgLangCode = (tgUser?.language_code || navigator.language || 'en').toLowerCase();
        if (tgLangCode.startsWith('zh')) {
          setLang(tgLangCode.includes('tw') || tgLangCode.includes('hk') || tgLangCode.includes('hant') ? 'zh-TW' : 'zh-CN');
        } else if (tgLangCode.startsWith('ja')) { setLang('ja'); }
        else if (tgLangCode.startsWith('ko')) { setLang('ko'); }
        else if (tgLangCode.startsWith('ru')) { setLang('ru'); }
        else { setLang('en'); }
        const userUsername = tgUser?.username || '';
        const checkIsAdmin = userUsername.toLowerCase() === 'mileschan852' || userUsername.toLowerCase() === 'hkmembersonly';
        setIsAdmin(checkIsAdmin);
        const userId = tgUser?.id ? `tg_${tgUser.id}` : ('user_' + Math.random().toString(36).substring(2, 9));
        localStorage.setItem('whos_nearby_user_id', userId);
        const userName = tgUser?.first_name || (tgUser?.id ? `User ${tgUser.id}` : 'Anonymous');
        const userAvatar = tgUser?.photo_url || '';
        if (!navigator.geolocation) { setIsLocationDenied(true); setIsReady(true); return; }
        // Try hard for a fix: high accuracy (WiFi hotspot triangulation can be
        // slow), then cached/low-accuracy, then a last low-accuracy retry with
        // a long timeout. maximumAge allows cached fixes so WiFi-only devices
        // aren't failed out on a 10s timer.
        // Track the actual fix in a local var: `location` state is stale within
        // this async function (setState doesn't apply mid-execution).
        let fix: { lat: number; lng: number } | null = null;
        const tryGeolocation = (opts: PositionOptions): Promise<boolean> =>
          new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => { fix = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocation(fix); resolve(true); },
              () => resolve(false),
              opts
            );
          });
        const hasLocation =
          (await tryGeolocation({ enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 })) ||
          (await tryGeolocation({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 })) ||
          (await tryGeolocation({ enableHighAccuracy: false, timeout: 20000, maximumAge: Infinity }));
        if (!hasLocation) { setLocation({ lat: 22.3193, lng: 114.1694 }); }
        let existingProfile: any = null;
        if (supabase) {
          const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (data) { existingProfile = data; }
        }
        if (existingProfile?.is_underage) { setIsUnderageLocked(true); setIsReady(true); return; }
        let initialGender = existingProfile?.gender || 'man';
        let initialSeeking = existingProfile?.seeking || 'women';
        if (!existingProfile && startParam === 'gaymode') { initialGender = 'man'; initialSeeking = 'men'; }
        setGender(initialGender); setSeeking(initialSeeking);
        const isManSeekingMan = initialGender === 'man' && initialSeeking === 'men';
        const isFullySetup = Boolean(
          existingProfile && existingProfile.dob && existingProfile.gender &&
          existingProfile.seeking && existingProfile.height && existingProfile.weight &&
          (!isManSeekingMan || (existingProfile.role_pref && existingProfile.safety_pref && existingProfile.playstyle_pref && existingProfile.how_many_pref && existingProfile.where_pref !== undefined)) &&
          (isManSeekingMan || existingProfile.non_man_mode)
        );
        let initialGridVisible = true;
        if (existingProfile) {
          if (existingProfile.dob) setDob(existingProfile.dob);
          if (existingProfile.height) setHeight(existingProfile.height);
          if (existingProfile.weight) setWeight(existingProfile.weight);
          if (existingProfile.role_pref) setRolePref(existingProfile.role_pref);
          if (existingProfile.safety_pref) setSafetyPref(existingProfile.safety_pref);
          if (existingProfile.playstyle_pref) setPlaystylePref(existingProfile.playstyle_pref);
          if (existingProfile.how_many_pref) setHowManyPref(existingProfile.how_many_pref);
          if (existingProfile.where_pref !== undefined && existingProfile.where_pref !== null) setWherePref(existingProfile.where_pref);
          if (existingProfile.non_man_mode) setNonManMode(existingProfile.non_man_mode);
          if (typeof existingProfile.hide_age === 'boolean') setHideAge(existingProfile.hide_age);
          if (existingProfile.hide_age_expiry) setHideAgeExpiry(existingProfile.hide_age_expiry);
          if (existingProfile.invisible_expiry) setInvisibleExpiry(existingProfile.invisible_expiry);
          if (existingProfile.filter_sub_expiry) { const ts = new Date(existingProfile.filter_sub_expiry).getTime(); if (!isNaN(ts) && ts > filterSubUntil) { setFilterSubUntil(ts); try { localStorage.setItem(FILTER_SUB_KEY, String(ts)); } catch {} } }
          if (typeof existingProfile.grid_visible === 'boolean') { initialGridVisible = existingProfile.grid_visible; setGridVisible(initialGridVisible); }
          if (typeof existingProfile.map_visible === 'boolean') setMapVisible(existingProfile.map_visible);
          if (isManSeekingMan) {
            applyDefaultFiltersFromPreferences(
              existingProfile.role_pref || 'Versatile', existingProfile.safety_pref || 'Safe',
              existingProfile.playstyle_pref || 'Clean', existingProfile.how_many_pref || 'DoesntMatter'
            );
          }
        }
        // Use the real GPS fix (or, if geolocation failed entirely, fall back
        // to the stored profile coords so we never overwrite them with the
        // default HK centroid and force distances to ~0).
        const currentLoc = fix ?? {
          lat: typeof existingProfile?.lat === 'number' ? existingProfile.lat : 22.3193,
          lng: typeof existingProfile?.lng === 'number' ? existingProfile.lng : 114.1694,
        };
        setLocation(currentLoc);
        if (!isFullySetup) {
          setShowProfileSetup(true);
          setCurrentUser({ id: userId, name: userName, username: userUsername, avatar: userAvatar, lat: null, lng: null, last_seen: null, gender: initialGender, seeking: initialSeeking, dob: null, height: null, weight: null, role_pref: null, safety_pref: null, playstyle_pref: null, where_pref: null, how_many_pref: null, non_man_mode: null, is_underage: false, hide_age: false, grid_visible: true, map_visible: false, hide_age_expiry: null, invisible_expiry: null });
        } else {
          const myProfile: UserProfile = { id: userId, name: userName, username: userUsername, avatar: userAvatar, lat: currentLoc.lat, lng: currentLoc.lng, last_seen: new Date().toISOString(), gender: initialGender, seeking: initialSeeking, dob: existingProfile.dob, height: existingProfile.height, weight: existingProfile.weight, role_pref: isManSeekingMan ? existingProfile.role_pref : null, safety_pref: isManSeekingMan ? existingProfile.safety_pref : null, playstyle_pref: isManSeekingMan ? existingProfile.playstyle_pref : null, where_pref: isManSeekingMan ? existingProfile.where_pref : null, how_many_pref: isManSeekingMan ? existingProfile.how_many_pref : null, non_man_mode: isManSeekingMan ? null : existingProfile.non_man_mode, is_underage: false, hide_age: existingProfile.hide_age || false, grid_visible: initialGridVisible, map_visible: existingProfile.map_visible ?? false, hide_age_expiry: existingProfile.hide_age_expiry || null, invisible_expiry: existingProfile.invisible_expiry || null };
          setCurrentUser(myProfile);
          if (supabase) {
            await supabase.from('profiles').upsert([{ ...myProfile, lat: currentLoc.lat, lng: currentLoc.lng, last_seen: new Date().toISOString(), grid_visible: initialGridVisible }], { onConflict: 'id' });
            await fetchUsersData(currentLoc.lat, currentLoc.lng, userId, checkIsAdmin);
          }
          loadFilterPrefs();
        }
      } catch (err) { console.error('Initialization error:', err); }
      finally { setIsReady(true); }
    };
    initApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; deps are intentionally frozen at init
  }, []);

  const handleRefresh = async () => {
    if (!currentUser || !currentUser.lat || !currentUser.lng || !supabase) return;
    const lastRefreshKey = `last_refresh_${currentUser.id}`;
    const lastRefreshTime = Number(localStorage.getItem(lastRefreshKey) || 0);
    const now = Date.now();
    if (now - lastRefreshTime < 5 * 60 * 1000) return;
    localStorage.setItem(lastRefreshKey, now.toString());
    await fetchUsersData(currentUser.lat, currentUser.lng, currentUser.id, isAdmin);
  };

  const handleToggleFilterDropdown = () => setShowFilterDropdown(!showFilterDropdown);

  const handleToggleFilterItem = async (key: 'age' | 'height' | 'prefMatcher') => {
    if (key === 'prefMatcher') {
      const next = !filterPrefMatcherOn;
      setFilterPrefMatcherOn(next);
      persistFilterPrefs({ prefMatcherOn: next });
      return;
    }
    if (!isAdmin && !(filterSubUntil > Date.now()) && !hasFilterSub) {
      const ok = await verifyFilterSubscription();
      if (!ok) return;
    }
    if (key === 'age') { const next = !filterAgeOn; setFilterAgeOn(next); persistFilterPrefs({ ageOn: next }); }
    else if (key === 'height') { const next = !filterHeightOn; setFilterHeightOn(next); persistFilterPrefs({ heightOn: next }); }
  };

  const handleToggleFilterValue = async (key: 'role' | 'safety' | 'playstyle' | 'howMany' | 'where') => {
    if (!isAdmin && !(filterSubUntil > Date.now()) && !hasFilterSub) {
      const ok = await verifyFilterSubscription();
      if (!ok) return;
    }
    const cycles: Record<string, string[]> = { role: filterRoleCycleOptions, safety: filterSafetyCycleOptions, playstyle: filterPlaystyleCycleOptions, howMany: filterHowManyCycleOptions, where: filterWhereCycleOptions };
    const getVal = () => { if (key === 'role') return filterRoleVal; if (key === 'safety') return filterSafetyVal; if (key === 'playstyle') return filterPlaystyleVal; if (key === 'howMany') return filterHowManyVal; return filterWhereVal; };
    const setVal = (v: string | null) => {
      if (key === 'role') setFilterRoleVal(v); else if (key === 'safety') setFilterSafetyVal(v);
      else if (key === 'playstyle') setFilterPlaystyleVal(v); else if (key === 'howMany') setFilterHowManyVal(v);
      else setFilterWhereVal(v);
      persistFilterPrefs({ roleVal: key === 'role' ? v : undefined, safetyVal: key === 'safety' ? v : undefined, playstyleVal: key === 'playstyle' ? v : undefined, howManyVal: key === 'howMany' ? v : undefined, whereVal: key === 'where' ? v : undefined } as any);
    };
    const options = cycles[key];
    const current = getVal();
    let next: string | null;
    if (!current) { next = options[0]; }
    else { const idx = options.indexOf(current); if (idx === -1 || idx === options.length - 1) next = null; else next = options[idx + 1]; }
    setVal(next);
  };

  const handleAgeRangeChange = (min: number, max: number) => { setFilterAgeMin(min); setFilterAgeMax(max); persistFilterPrefs({ ageMin: min, ageMax: max }); };
  const handleHeightRangeChange = (min: number, max: number) => { setFilterHeightMin(min); setFilterHeightMax(max); persistFilterPrefs({ heightMin: min, heightMax: max }); };

  const handleSaveInitialProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const isManSeekingMan = gender === 'man' && seeking === 'men';
    if (!dob || !gender || !seeking || !height || !weight || (isManSeekingMan && (!rolePref || !safetyPref || !playstylePref || !howManyPref || wherePref === undefined)) || (!isManSeekingMan && !nonManMode)) { setErrorMessage(t('fillAll')); return; }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) {
      if (currentUser && supabase) { await supabase.from('profiles').upsert([{ ...currentUser, dob, is_underage: true }], { onConflict: 'id' }); }
      setIsUnderageLocked(true); return;
    }
    if (!currentUser || !supabase) return;
    const updatedProfile = { ...currentUser, lat: location.lat, lng: location.lng, last_seen: new Date().toISOString(), dob, gender, seeking, height, weight, role_pref: isManSeekingMan ? rolePref : null, safety_pref: isManSeekingMan ? safetyPref : null, playstyle_pref: isManSeekingMan ? playstylePref : null, how_many_pref: isManSeekingMan ? howManyPref : null, where_pref: isManSeekingMan ? wherePref : null, non_man_mode: isManSeekingMan ? null : nonManMode, hide_age: false, is_underage: false };
    const { error } = await supabase.from('profiles').upsert([updatedProfile], { onConflict: 'id' });
    if (error) { setErrorMessage(`${t('errorSaving')} ${error.message}`); return; }
    if (isManSeekingMan) applyDefaultFiltersFromPreferences(rolePref, safetyPref, playstylePref, howManyPref);
    setCurrentUser(updatedProfile); setShowProfileSetup(false); setShowProfileEditModal(false);
    loadFilterPrefs();
    await fetchUsersData(location.lat, location.lng, currentUser.id, isAdmin);
  };

  // Open a Telegram invoice with a graceful fallback if openInvoice is
  // unavailable (desktop bug, older client): returns 'paid', 'failed', or 'unsupported'.
  const startInvoice = (invoiceLink: string): Promise<string> => {
    return new Promise((resolve) => {
      const w = window.Telegram?.WebApp;
      if (w?.openInvoice) {
        w.openInvoice(invoiceLink, (status: string) => resolve(status === 'paid' ? 'paid' : 'failed'));
      } else if (typeof invoiceLink === 'string' && invoiceLink.startsWith('https://t.me/')) {
        try { w?.openTelegramLink?.(invoiceLink) ?? window.open(invoiceLink, '_blank'); } catch { window.open(invoiceLink, '_blank'); }
        resolve('unsupported'); // client UI can't observe the result; do NOT auto-apply perks
      } else {
        resolve('failed');
      }
    });
  };

  const verifyFilterSubscription = async (): Promise<boolean> => {
    if (isAdmin || hasFilterSub) return true;
    const confirmed = window.confirm(t('filterSubPrompt'));
    if (!confirmed) return false;
    if (!PAYMENT_WORKER_URL) { console.error('VITE_PAYMENT_WORKER_URL is not set'); return false; }
    try {
      const res = await fetch(`${PAYMENT_WORKER_URL}/create-invoice`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, type: 'change_filter', bot: getActiveBotKey() }),
      });
      if (!res.ok) { console.error('create-invoice failed:', res.status); alert(t('paymentCancelled')); return false; }
      const data = await res.json() as { invoiceLink?: string };
      if (data.invoiceLink) {
        const status = await startInvoice(data.invoiceLink);
        if (status === 'paid') { setHasFilterSub(true); const subUntil = Date.now() + 30 * 24 * 60 * 60 * 1000; setFilterSubUntil(subUntil); filterSubUntilRef.current = subUntil; try { localStorage.setItem(FILTER_SUB_KEY, String(subUntil)); } catch {} if (currentUser && supabase) { const newExpiry = new Date(subUntil).toISOString(); supabase.from('profiles').update({ filter_sub_expiry: newExpiry }).eq('id', currentUser.id).then(() => {}); setCurrentUser((p: any) => p ? { ...p, filter_sub_expiry: newExpiry } : p); } }
        else { if (status !== 'unsupported') alert(t('paymentCancelled')); return false; }
      }
    } catch (err) { console.error('Invoice error:', err); }
    return false;
  };

  const FILTER_PREFS_KEY = 'whos_nearby_filter_prefs';
  const FILTER_SUB_KEY = 'whos_nearby_filter_sub_until';

  const loadFilterPrefs = () => {
    try {
      const subRaw = localStorage.getItem(FILTER_SUB_KEY);
      let subUntil = filterSubUntilRef.current;
      if (subRaw) { const n = Number(subRaw); if (!isNaN(n)) subUntil = n; }
      // Drop expired cached subscriptions so stale localStorage can't grant access.
      if (subUntil && subUntil <= Date.now()) {
        subUntil = 0;
        try { localStorage.removeItem(FILTER_SUB_KEY); } catch {}
      }
      setFilterSubUntil(subUntil); filterSubUntilRef.current = subUntil;
      const raw = localStorage.getItem(FILTER_PREFS_KEY);
      if (!raw) { setFilterAgeOn(false); setFilterHeightOn(false); setFilterPrefMatcherOn(true); return; }
      const saved = JSON.parse(raw);
      const hasSub = isAdmin || (subUntil > Date.now());
      if (!hasSub) { setFilterAgeOn(false); setFilterHeightOn(false); setFilterPrefMatcherOn(true); return; }
      setFilterAgeOn(!!saved.ageOn);
      if (typeof saved.ageMin === 'number') setFilterAgeMin(saved.ageMin);
      if (typeof saved.ageMax === 'number') setFilterAgeMax(saved.ageMax);
      setFilterHeightOn(!!saved.heightOn);
      if (typeof saved.heightMin === 'number') setFilterHeightMin(saved.heightMin);
      if (typeof saved.heightMax === 'number') setFilterHeightMax(saved.heightMax);
      setFilterPrefMatcherOn(saved.prefMatcherOn !== false);
      if (saved.roleVal !== undefined) setFilterRoleVal(saved.roleVal);
      if (saved.safetyVal !== undefined) setFilterSafetyVal(saved.safetyVal);
      if (saved.playstyleVal !== undefined) setFilterPlaystyleVal(saved.playstyleVal);
      if (saved.howManyVal !== undefined) setFilterHowManyVal(saved.howManyVal);
      if (saved.whereVal !== undefined) setFilterWhereVal(saved.whereVal);
    } catch (e) { console.error('Load filter prefs error:', e); }
  };

  const persistFilterPrefs = (next: any) => {
    try {
      const hasSub = isAdmin || (filterSubUntilRef.current > Date.now());
      if (!hasSub) return;
      const saved = { ageOn: next.ageOn !== undefined ? next.ageOn : filterAgeOn, ageMin: next.ageMin !== undefined ? next.ageMin : filterAgeMin, ageMax: next.ageMax !== undefined ? next.ageMax : filterAgeMax, heightOn: next.heightOn !== undefined ? next.heightOn : filterHeightOn, heightMin: next.heightMin !== undefined ? next.heightMin : filterHeightMin, heightMax: next.heightMax !== undefined ? next.heightMax : filterHeightMax, prefMatcherOn: next.prefMatcherOn !== undefined ? next.prefMatcherOn : filterPrefMatcherOn, roleVal: next.roleVal !== undefined ? next.roleVal : filterRoleVal, safetyVal: next.safetyVal !== undefined ? next.safetyVal : filterSafetyVal, playstyleVal: next.playstyleVal !== undefined ? next.playstyleVal : filterPlaystyleVal, howManyVal: next.howManyVal !== undefined ? next.howManyVal : filterHowManyVal, whereVal: next.whereVal !== undefined ? next.whereVal : filterWhereVal };
      localStorage.setItem(FILTER_PREFS_KEY, JSON.stringify(saved));
    } catch (e) { console.error('Persist filter prefs error:', e); }
  };

  const handleToggleGrid = async () => {
    if (!currentUser || !supabase) return;
    let nextVal = !gridVisible;
    let newInvisibleExpiry = invisibleExpiry;
    if (!nextVal && !isAdmin) {
      const now = new Date();
      const isExpired = !invisibleExpiry || new Date(invisibleExpiry).getTime() < now.getTime();
      if (isExpired) {
        const confirmed = window.confirm(t('invisiblePrompt'));
        if (!confirmed) return;
        if (!PAYMENT_WORKER_URL) { console.error('VITE_PAYMENT_WORKER_URL is not set'); return; }
        try {
          const res = await fetch(`${PAYMENT_WORKER_URL}/create-invoice`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, type: 'invisible', bot: getActiveBotKey() }),
          });
          if (!res.ok) { console.error('create-invoice failed:', res.status); alert(t('paymentCancelled')); return; }
          const data = await res.json() as { invoiceLink?: string };
          if (data.invoiceLink) {
            const status = await startInvoice(data.invoiceLink);
            if (status === 'paid') {
              const expiryDate = new Date(); expiryDate.setDate(expiryDate.getDate() + 30);
              newInvisibleExpiry = expiryDate.toISOString(); setInvisibleExpiry(newInvisibleExpiry);
              setGridVisible(false); const updated = { ...currentUser, grid_visible: false, invisible_expiry: newInvisibleExpiry };
              setCurrentUser(updated); await supabase.from('profiles').upsert([updated], { onConflict: 'id' });
              setView('grid');
              if (currentUser.lat && currentUser.lng) await fetchUsersData(currentUser.lat, currentUser.lng, currentUser.id, isAdmin);
            } else if (status !== 'unsupported') { alert(t('paymentCancelled')); }
            return;
          }
        } catch (err) { console.error('Invisible invoice error:', err); }
      }
    } else if (nextVal) {
      // Turning invisible OFF: clear the expiry so it can't linger as "active".
      newInvisibleExpiry = null; setInvisibleExpiry(null);
    }
    setGridVisible(nextVal); const updated = { ...currentUser, grid_visible: nextVal, invisible_expiry: newInvisibleExpiry };
    setCurrentUser(updated); await supabase.from('profiles').upsert([updated], { onConflict: 'id' });
    setView('grid');
    if (currentUser.lat && currentUser.lng) await fetchUsersData(currentUser.lat, currentUser.lng, currentUser.id, isAdmin);
  };

  const handleToggleMap = async () => {
    if (!currentUser || !supabase) return;
    const nextVal = !mapVisible; setMapVisible(nextVal);
    const updated = { ...currentUser, map_visible: nextVal }; setCurrentUser(updated);
    await supabase.from('profiles').upsert([updated], { onConflict: 'id' });
    setView(nextVal ? 'map' : 'grid');
    if (currentUser.lat && currentUser.lng) await fetchUsersData(currentUser.lat, currentUser.lng, currentUser.id, isAdmin);
  };

  const handleUpdateSelfField = async (fields: Partial<UserProfile>) => {
    if (!currentUser || !supabase) return;
    const updated = { ...currentUser, ...fields }; setCurrentUser(updated);
    await supabase.from('profiles').upsert([updated], { onConflict: 'id' });
  };

  const handleHideAgeToggle = async () => {
    if (!currentUser || !supabase) return;
    let nextHide = !hideAge; let newExpiry = hideAgeExpiry;
    if (nextHide && !isAdmin) {
      const now = new Date(); const isExpired = !hideAgeExpiry || new Date(hideAgeExpiry).getTime() < now.getTime();
      if (isExpired) {
        const confirmed = window.confirm(t('hideAgePrompt')); if (!confirmed) return;
        if (!PAYMENT_WORKER_URL) { console.error('VITE_PAYMENT_WORKER_URL is not set'); return; }
        try {
          const res = await fetch(`${PAYMENT_WORKER_URL}/create-invoice`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, type: 'hide_age', bot: getActiveBotKey() }),
          });
          if (!res.ok) { console.error('create-invoice failed:', res.status); alert(t('paymentCancelled')); return; }
          const data = await res.json() as { invoiceLink?: string };
          if (data.invoiceLink) {
            const status = await startInvoice(data.invoiceLink);
            if (status === 'paid') {
              const expiryDate = new Date(); expiryDate.setDate(expiryDate.getDate() + 30);
              newExpiry = expiryDate.toISOString(); setHideAgeExpiry(newExpiry); setHideAge(true);
              await handleUpdateSelfField({ hide_age: true, hide_age_expiry: newExpiry });
            } else if (status !== 'unsupported') { alert(t('paymentCancelled')); }
            return;
          }
        } catch (err) { console.error('Hide age invoice error:', err); }
      }
    } else if (!nextHide) { newExpiry = null; setHideAgeExpiry(null); }
    setHideAge(nextHide); await handleUpdateSelfField({ hide_age: nextHide, hide_age_expiry: newExpiry });
  };

  const handleCardClick = (targetUser: UserProfile) => { setShowFilterDropdown(false); setSelectedProfile(targetUser); if (currentUser && targetUser.id !== currentUser.id) loadPrivateNote(targetUser.id); else { setNoteDraft(''); setShowNoteBox(false); } };

  const handleStartChat = (targetUser: UserProfile) => {
    if (!checkFilterPass(targetUser)) return;
    if (targetUser.username) {
      const chatUrl = `https://t.me/${targetUser.username}`;
      if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(chatUrl);
      else window.open(chatUrl, '_blank');
    } else if (targetUser.id.startsWith('tg_')) {
      const rawTgId = targetUser.id.replace('tg_', '');
      const profileUrl = `https://t.me/user?id=${rawTgId}`;
      if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(profileUrl);
      else window.open(profileUrl, '_blank');
    } else { alert(t('selectedUser').replace('{n}', targetUser.name)); }
    setSelectedProfile(null);
  };

  const checkFilterPass = (user: UserProfile) => {
    if (currentUser && user.id === currentUser.id) return true;
    if (filterAgeOn) { const age = calculateAge(user.dob); if (age === null || age < filterAgeMin || age > filterAgeMax) return false; }
    if (filterHeightOn) { const h = parseHeightMeters(user.height); if (h === null || h < filterHeightMin || h > filterHeightMax) return false; }
    const userIsManSeekingMan = user.gender === 'man' && user.seeking === 'men';
    if (filterPrefMatcherOn && userIsManSeekingMan) {
      if (filterRoleVal && filterRoleVal !== 'Off') {
        if (filterRoleVal === 'VT') { if (user.role_pref !== 'Versatile' && user.role_pref !== 'Top') return false; }
        else if (filterRoleVal === 'VB') { if (user.role_pref !== 'Versatile' && user.role_pref !== 'Bottom') return false; }
        else { if (user.role_pref !== filterRoleVal && user.role_pref !== 'Versatile') return false; }
      }
      if (filterSafetyVal && filterSafetyVal !== 'Off') { if (user.safety_pref !== filterSafetyVal) return false; }
      if (filterPlaystyleVal && filterPlaystyleVal !== 'Off') {
        if (filterPlaystyleVal === 'Party') { if (user.playstyle_pref !== 'Party' && user.playstyle_pref !== 'Party✓') return false; }
        else if (user.playstyle_pref !== filterPlaystyleVal) return false;
      }
      if (filterWhereVal && filterWhereVal !== 'Off') { if (user.where_pref !== filterWhereVal) return false; }
    }
    return true;
  };

  const handleOpenExternalApp = (url: string) => {
    if (url.includes('t.me') && window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
  };

  // On app load: read ALL existing private notes from Telegram CloudStorage
  // (falling back to localStorage) so each profile card shows its saved note.
  const NOTE_PREFIX = 'whos_nearby_private_note_';
  useEffect(() => {
    const hydrate = (k: string, val: string | null | undefined) => {
      const text = parseNotePayload(val);
      if (text === null) return;
      const targetId = k.slice(NOTE_PREFIX.length).split('_').slice(1).join('_');
      if (!targetId) return;
      setNotesMap((m) => (m[targetId] === text ? m : { ...m, [targetId]: text }));
    };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NOTE_PREFIX)) hydrate(k, localStorage.getItem(k));
      }
    } catch {}
    const cs: any = window.Telegram?.WebApp?.CloudStorage;
    if (cs?.getItems) {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(NOTE_PREFIX)) keys.push(k);
        }
        cs.getItems(keys, (err: any, val: any) => { if (!err && val) Object.entries(val).forEach(([k, v]) => hydrate(k, v as string)); });
      } catch {}
    } else if (cs?.getItem) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(NOTE_PREFIX)) cs.getItem(k, (err: any, val: any) => { if (!err) hydrate(k, val); });
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!isReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: '#ffffff', fontFamily: 'sans-serif' }}><p>{t('loading')}</p></div>;
  }
  if (isLocationDenied) {
    return <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#ff4d4d', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center', boxSizing: 'border-box' }}><h2 style={{ fontSize: '24px', marginBottom: '16px' }}>{t('locationRequired')}</h2><p style={{ fontSize: '16px', color: '#ffffff', maxWidth: '360px', lineHeight: '1.5' }}>{t('locationMessage')}</p></div>;
  }
  if (isUnderageLocked) {
    return <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#ff4d4d', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center', boxSizing: 'border-box' }}><h2 style={{ fontSize: '24px', marginBottom: '16px' }}>{t('accessDenied')}</h2><p style={{ fontSize: '16px', color: '#ffffff', maxWidth: '360px', lineHeight: '1.5' }}>{t('underageMessage')}</p></div>;
  }

  const noteKeyFor = (targetId: string | undefined) => {
    const viewerId = currentUser?.id || localStorage.getItem('whos_nearby_user_id') || 'anon';
    return `whos_nearby_private_note_${viewerId}_${targetId}`;
  };

  // Private notes are stored ONLY in Telegram CloudStorage (bot-scoped, per-user)
  // with a localStorage cache. They are never written to Supabase.
  // Stored payload: JSON { t: text, x: expiryEpochMs|null } (expiry = 30 days
  // from last save, using the same 30-day window as other subscriptions).
  const NOTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  const parseNotePayload = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    try {
      const p = JSON.parse(raw);
      if (p && typeof p.t === 'string') {
        if (p.x && Number(p.x) < Date.now()) return null; // expired
        return (p.t || '').slice(0, 100);
      }
    } catch {}
    return raw.slice(0, 100); // legacy plain-text value
  };

  const loadPrivateNote = (targetId: string | undefined) => {
    if (!targetId || targetId === currentUser?.id) { setNoteDraft(''); setShowNoteBox(false); return; }
    const key = noteKeyFor(targetId);
    const apply = (val: string | null | undefined) => { const text = parseNotePayload(val); if (text !== null) { setNoteDraft(text); setNotesMap((m) => ({ ...m, [targetId]: text })); setShowNoteBox(text.trim().length > 0); } };
    setNoteDraft(notesMap[targetId] || '');
    setShowNoteBox((notesMap[targetId] || '').trim().length > 0);
    try {
      const local = localStorage.getItem(key);
      if (local !== null) apply(local);
    } catch {}
    try {
      const cs = window.Telegram?.WebApp?.CloudStorage;
      cs?.getItem?.(key, (err, val) => { if (!err) apply(val); });
    } catch {}
  };

  const savePrivateNote = (targetId: string | undefined, value: string) => {
    if (!targetId || targetId === currentUser?.id) return;
    const text = (value || '').slice(0, 100);
    setNoteDraft(text);
    setShowNoteBox(text.trim().length > 0);
    setNotesMap((m) => ({ ...m, [targetId]: text }));
    const key = noteKeyFor(targetId);
    const payload = JSON.stringify({ t: text, x: text ? Date.now() + NOTE_TTL_MS : null });
    try { localStorage.setItem(key, payload); } catch {}
    try { window.Telegram?.WebApp?.CloudStorage?.setItem?.(key, payload); } catch {}
  };

  const handleForceReset = async () => {
    if (!selectedProfile || !PAYMENT_WORKER_URL) return;
    if (!window.confirm(t('forceResetConfirm').replace('{n}', selectedProfile.name || ''))) return;
    try {
      await fetch(`${PAYMENT_WORKER_URL}/api/reset-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: currentUser?.id ? Number(String(currentUser.id).replace(/^tg_/, '')) : null, target_id: Number(String(selectedProfile.id).replace(/^tg_/, '')) }),
      });
      alert(t('profileReset'));
    } catch (e) { console.error(e); alert(t('resetFailed')); }
  };

  const handleResetAllUnderage = async () => {
    if (!isAdmin || !PAYMENT_WORKER_URL) return;
    if (!window.confirm(t('resetAllUnderageConfirm'))) return;
    try {
      await fetch(`${PAYMENT_WORKER_URL}/api/reset-all-underage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller_id: currentUser?.id ? Number(String(currentUser.id).replace(/^tg_/, '')) : null }),
      });
      alert(t('profileReset'));
    } catch (e) { console.error(e); alert(t('resetFailed')); }
  };

  const filterSubStatusInfo = (() => {
    if (!isAdmin && !hasFilterSub && !(filterSubUntil > Date.now())) return { label: t('unsubscribed'), color: '#888' };
    if (filterSubUntil > Date.now()) return { label: t('subscribedUntil').replace('{d}', new Date(filterSubUntil).toLocaleDateString()), color: '#4ade80' };
    return { label: t('expired'), color: '#e11d48' };
  })();

  const isViewingSelf = selectedProfile ? (currentUser && selectedProfile.id === currentUser.id) : false;
  const activeProfile = selectedProfile;
  const gridFilteredUsers = users;
  // Self is excluded from the shared list; your own pin is rendered separately
  // at your live GPS location and is visible ONLY to you (greyed out only when
  // actually invisible, i.e. grid toggle off - NOT when the map toggle is off).
  const mapFilteredUsers = users.filter((u) => (u.id === currentUser?.id ? false : (u.map_visible === true)));
  const isManSeekingManInput = gender === 'man' && seeking === 'men';
  const targetIsManSeekingMan = activeProfile?.gender === 'man' && activeProfile?.seeking === 'men';
  const isHkModEntry = (window.Telegram?.WebApp?.initDataUnsafe?.start_param === 'gaymode' || window.location.search.includes('mode=gay'));
  const passesFilterForActive = activeProfile ? checkFilterPass(activeProfile) : true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#ffffff', fontFamily: 'sans-serif', overflow: 'hidden' }}>

      {(showProfileSetup || showProfileEditModal) && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#121212', zIndex: 99999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '12px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '16px', width: '100%', maxWidth: '420px', boxSizing: 'border-box', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
            {showProfileEditModal && (<button onClick={() => setShowProfileEditModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'transparent', border: 'none', color: '#aaa', fontSize: '18px', cursor: 'pointer' }}>✕</button>)}
            <h2 style={{ fontSize: '18px', margin: 0, color: '#007bff', textAlign: 'center' }}>{t('completeProfile')}</h2>
            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff4d4d', textAlign: 'center', margin: 0, lineHeight: '1.4' }}>{t('profileWarning')}</p>
            {errorMessage && (<div style={{ backgroundColor: 'rgba(255, 77, 77, 0.25)', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '6px', borderRadius: '4px', fontSize: '11px', textAlign: 'center' }}>{errorMessage}</div>)}
            <form onSubmit={handleSaveInitialProfile} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('dob')}</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ padding: '6px 8px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px', colorScheme: 'dark' }} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', width: '100%' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>{t('imA')}</span>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={isHkModEntry} style={{ flex: 1, minWidth: 0, padding: '6px 4px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }}>
                    <option value="man">{t('man')}</option><option value="woman">{t('woman')}</option><option value="non-binary">{t('nonBinary')}</option>
                  </select>
                  <span style={{ whiteSpace: 'nowrap' }}>{t('seeking')}</span>
                  <select value={seeking} onChange={(e) => setSeeking(e.target.value)} disabled={isHkModEntry} style={{ flex: 1, minWidth: 0, padding: '6px 4px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }}>
                    <option value="men">{t('men')}</option><option value="women">{t('women')}</option><option value="everyone">{t('everyone')}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('height')}</label>
                  <select value={height} onChange={(e) => setHeight(e.target.value)} style={{ padding: '6px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }} required>
                    <option value="" disabled>{t('selectHeight')}</option>
                    {heightOptions.map((h, idx) => (<option key={idx} value={h}>{h}</option>))}
                  </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('weight')}</label>
                  <select value={weight} onChange={(e) => setWeight(e.target.value)} style={{ padding: '6px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '12px' }} required>
                    <option value="" disabled>{t('selectWeight')}</option>
                    {weightOptions.map((w, idx) => (<option key={idx} value={w}>{w}</option>))}
                  </select>
                </div>
              </div>
              <div style={{ width: '100%', borderTop: '1px solid #444', margin: '4px 0' }} />
              {isManSeekingManInput ? (<>
                <div style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>{t('tapToChange')}</div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                  <button type="button" onClick={() => setRolePref(cycleNext(rolePref, roleCycleOptions))} style={{ flex: 1, padding: '10px 2px', backgroundColor: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>{t(rolePref)}</button>
                  <button type="button" onClick={() => setSafetyPref(cycleNext(safetyPref, safetyCycleOptions))} style={{ flex: 1, padding: '10px 2px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>{t(safetyPref)}</button>
                  <button type="button" onClick={() => setPlaystylePref(cycleNext(playstylePref, ['Clean', 'Party']))} style={{ flex: 1, padding: '10px 2px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>{t(playstylePref)}</button>
                  <button type="button" onClick={() => setHowManyPref(cycleNext(howManyPref, howManyCycleOptions))} style={{ flex: 1, padding: '10px 2px', backgroundColor: '#9333ea', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>{t(`${howManyPref}_setup`)}</button>
                  <button type="button" onClick={() => setWherePref(cycleWhere(wherePref, whereCycleOptions))} style={{ flex: 1, padding: '10px 2px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}>{wherePref === null ? t('Anywhere') : t(wherePref)}</button>
                </div>
              </>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>{t('mode')}</label>
                <select value={nonManMode} onChange={(e) => setNonManMode(e.target.value)} style={{ padding: '6px', backgroundColor: '#222', color: '#fff', border: '1px solid #555', borderRadius: '4px', fontSize: '10px' }} required>
                  <option value="Browsing only - You cannot send not receive private message from others">{t('browsingOnly')}</option>
                  <option value="Online only - You are visible on grid but not on map, map is inaccessible">{t('onlineOnly')}</option>
                  <option value="Meet up - You are visible on grid and map">{t('meetUp')}</option>
                </select>
              </div>)}
              <button type="submit" style={{ marginTop: '4px', padding: '10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>{t('saveProfile')}</button>
            </form>
          </div>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '60px', minHeight: '60px', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <h1 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold' }}>{t('whosNearby')} ({gridFilteredUsers.length})</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <button onClick={handleToggleFilterDropdown} style={{ width: '36px', height: '36px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('filter')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          </button>
          {showFilterDropdown && (
            <div style={{ position: 'absolute', top: '44px', right: '0', zIndex: 2000, backgroundColor: '#1e1e1e', border: '1px solid #444', borderRadius: '8px', padding: '12px', width: '280px', boxShadow: '0 6px 20px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{t('filterUsers')}<span style={{ fontSize: '11px', fontWeight: 'normal', color: filterSubStatusInfo.color }}>{isAdmin ? t('admin') : `${filterSubStatusInfo.label}${filterSubUntil > Date.now() ? ` · ${t('expires')} ${new Date(filterSubUntil).toLocaleDateString()}` : ''}`}</span></div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleToggleFilterItem('age')}>
                  <input type="checkbox" checked={filterAgeOn} onChange={() => {}} style={{ width: '16px', height: '16px', accentColor: '#007bff', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>{t('ageRange')}</span>
                </div>
                {filterAgeOn && (<div style={{ marginTop: '8px', padding: '0 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}><span>{filterAgeMin}</span><span>{filterAgeMax}</span></div>
                  <input type="range" min={18} max={80} value={filterAgeMin} onChange={(e) => { const v = Number(e.target.value); if (v <= filterAgeMax) handleAgeRangeChange(v, filterAgeMax); }} style={{ width: '100%', accentColor: '#007bff' }} />
                  <input type="range" min={18} max={80} value={filterAgeMax} onChange={(e) => { const v = Number(e.target.value); if (v >= filterAgeMin) handleAgeRangeChange(filterAgeMin, v); }} style={{ width: '100%', accentColor: '#007bff', marginTop: '-8px' }} />
                </div>)}
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleToggleFilterItem('height')}>
                  <input type="checkbox" checked={filterHeightOn} onChange={() => {}} style={{ width: '16px', height: '16px', accentColor: '#007bff', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>{t('height')}</span>
                </div>
                {filterHeightOn && (<div style={{ marginTop: '8px', padding: '0 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}><span>{filterHeightMin / 100}m</span><span>{filterHeightMax / 100}m</span></div>
                  <input type="range" min={140} max={220} step={1} value={filterHeightMin} onChange={(e) => { const v = Number(e.target.value); if (v <= filterHeightMax) handleHeightRangeChange(v, filterHeightMax); }} style={{ width: '100%', accentColor: '#007bff' }} />
                  <input type="range" min={140} max={220} step={1} value={filterHeightMax} onChange={(e) => { const v = Number(e.target.value); if (v >= filterHeightMin) handleHeightRangeChange(filterHeightMin, v); }} style={{ width: '100%', accentColor: '#007bff', marginTop: '-8px' }} />
                </div>)}
              </div>
              {isManSeekingManInput && (<div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleToggleFilterItem('prefMatcher')}>
                  <input type="checkbox" checked={filterPrefMatcherOn} onChange={() => {}} style={{ width: '16px', height: '16px', accentColor: '#007bff', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>{t('preferenceMatcher')}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', paddingLeft: '24px' }}>{t('m2m')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingLeft: '24px' }}>
                  <button type="button" onClick={() => handleToggleFilterValue('role')} style={{ flex: '1 1 40%', minWidth: '90px', padding: '8px 4px', backgroundColor: filterRoleVal ? '#e11d48' : '#2a2a2a', color: '#fff', border: filterRoleVal ? '1px solid #e11d48' : '1px solid #444', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', opacity: filterRoleVal ? 1 : 0.45, filter: filterRoleVal ? 'none' : 'grayscale(100%)' }}>{filterRoleVal ? formatTagText(t(filterRoleVal)) : t('Off')}</button>
                  <button type="button" onClick={() => handleToggleFilterValue('safety')} style={{ flex: '1 1 40%', minWidth: '90px', padding: '8px 4px', backgroundColor: filterSafetyVal ? '#2563eb' : '#2a2a2a', color: '#fff', border: filterSafetyVal ? '1px solid #2563eb' : '1px solid #444', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', opacity: filterSafetyVal ? 1 : 0.45, filter: filterSafetyVal ? 'none' : 'grayscale(100%)' }}>{filterSafetyVal ? formatTagText(t(filterSafetyVal)) : t('Off')}</button>
                  <button type="button" onClick={() => handleToggleFilterValue('playstyle')} style={{ flex: '1 1 40%', minWidth: '90px', padding: '8px 4px', backgroundColor: filterPlaystyleVal ? '#16a34a' : '#2a2a2a', color: '#fff', border: filterPlaystyleVal ? '1px solid #16a34a' : '1px solid #444', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', opacity: filterPlaystyleVal ? 1 : 0.45, filter: filterPlaystyleVal ? 'none' : 'grayscale(100%)' }}>{filterPlaystyleVal ? formatTagText(t(filterPlaystyleVal)) : t('Off')}</button>
                  <div style={{ flex: '1 1 40%', minWidth: '90px', padding: '8px 4px', backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', textAlign: 'center', opacity: 0.45, filter: 'grayscale(100%)', cursor: 'not-allowed' }}>{t('Off')}</div>
                  <button type="button" onClick={() => handleToggleFilterValue('where')} style={{ flex: '1 1 40%', minWidth: '90px', padding: '8px 4px', backgroundColor: filterWhereVal ? '#d97706' : '#2a2a2a', color: '#fff', border: filterWhereVal ? '1px solid #d97706' : '1px solid #444', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', opacity: filterWhereVal ? 1 : 0.45, filter: filterWhereVal ? 'none' : 'grayscale(100%)' }}>{filterWhereVal ? formatTagText(t(filterWhereVal)) : t('Off')}</button>
                </div>
              </div>)}
            </div>
          )}
          <button onClick={handleRefresh} style={{ width: '36px', height: '36px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('refresh')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>
        </div>
      </header>

      <main style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: view === 'grid' ? 'block' : 'none', height: '100%', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', padding: '4px' }}>
            {gridFilteredUsers.map((user, index) => {
              const isSelf = currentUser && user.id === currentUser.id;
              const passesFilter = checkFilterPass(user);
              const isUserVisible = user.grid_visible !== false;
              const opacity = isUserVisible ? 1 : 0.3;
              const filterStyle = passesFilter ? 'none' : 'grayscale(100%)';
              const bigDistanceText = formatDistanceBigUnit(user.distance);
              const online15 = isOnlineWithin15Min(user.last_seen);
              return (
                <div key={user.id || index} onClick={() => handleCardClick(user)} style={{ position: 'relative', aspectRatio: '1/1', cursor: 'pointer', backgroundColor: '#222', overflow: 'hidden', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity, filter: filterStyle }}>
                  {user.avatar ? (<img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<div style={{ width: '100%', height: '100%', backgroundColor: '#0088cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>)}
                  {online15 && (<div style={{ position: 'absolute', top: '4px', right: '4px', width: '10px', height: '10px', backgroundColor: '#4ade80', borderRadius: '50%', border: '2px solid #121212', zIndex: 2 }} />)}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px', fontSize: '10px', textAlign: 'center' }}>{isSelf ? t('you') : bigDistanceText}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: view === 'map' ? 'block' : 'none', height: '100%', width: '100%', position: 'relative', flex: 1, zIndex: 1 }}>
          <MapContainer center={[location.lat, location.lng]} zoom={15} style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }} zoomControl={false}>
            <MapController center={[location.lat, location.lng]} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            <TileFallbackController />
            <MarkerClusterGroup chunkedLoading>
              {/* Your own pin: ALWAYS visible to you only, at your live GPS coords, greyed out unless green. */}
              {currentUser && typeof location.lat === 'number' && typeof location.lng === 'number' && (
                <Marker
                  key="self-pin"
                  position={[location.lat, location.lng]}
                  icon={createProfileIcon(currentUser, gridVisible, true, isOnlineWithin15Min(currentUser.last_seen))}
                  eventHandlers={{ click: () => handleCardClick(currentUser) }}
                />
              )}
              {mapFilteredUsers.map((user) => {
                // Skip users with no known coordinates entirely: never fall back
                // to the viewer's own location (that piled every user onto one spot).
                if (typeof user.lat !== 'number' || typeof user.lng !== 'number') return null;
                const isUserVisible = user.grid_visible !== false;
                const isEnabled = isUserVisible;
                const isOnline = isOnlineWithin15Min(user.last_seen);
                return (<Marker key={user.id} position={[user.lat, user.lng]} icon={createProfileIcon(user, isEnabled, false, isOnline)} eventHandlers={{ click: () => handleCardClick(user) }} />);
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </main>

      {activeProfile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={() => setSelectedProfile(null)}>
          <div style={{ position: 'relative', backgroundColor: '#1e1e1e', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '24px 20px 40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            {!isViewingSelf && (
              <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 5, display: 'flex', gap: '6px' }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); setShowNoteBox((v) => !v); }} style={{ padding: '2px 8px', backgroundColor: noteDraft ? '#b45309' : '#2a2a2a', border: '1px solid #444', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }} title={t('privateNote')}>📝</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleForceReset(); }} style={{ padding: '2px 8px', backgroundColor: '#7f1d1d', border: '1px solid #444', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }} title={t('forceReset')}>🔁</button>
              </div>
            )}
            {isViewingSelf && isAdmin && (
              <button type="button" onClick={(e) => { e.stopPropagation(); handleResetAllUnderage(); }} style={{ position: 'absolute', top: '14px', left: '14px', zIndex: 5, padding: '2px 8px', backgroundColor: '#7f1d1d', border: '1px solid #444', borderRadius: '6px', fontSize: '12px', color: '#fff', cursor: 'pointer' }} title={t('resetAllUnderage')}>{t('resetAllUnderage')}</button>
            )}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#444', borderRadius: '2px', marginBottom: '16px' }} />
            <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#222', border: '3px solid #007bff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', filter: passesFilterForActive ? 'none' : 'grayscale(100%)' }}>
                {activeProfile.avatar ? (<img src={activeProfile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<span style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff' }}>{activeProfile.name ? activeProfile.name.charAt(0).toUpperCase() : 'U'}</span>)}
              </div>
              <h2 style={{ fontSize: '20px', marginBottom: '6px', color: '#ffffff', fontWeight: 'bold' }}>{activeProfile.name}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', fontSize: '13px', color: '#ccc', marginBottom: '16px', alignItems: 'center' }}>
                {!activeProfile.hide_age && calculateAge(activeProfile.dob) && <span>{calculateAge(activeProfile.dob)}</span>}
                {getZodiacSignEmoji(activeProfile.dob)}<span>&bull;</span><span>{activeProfile.height}</span><span>&bull;</span><span>{activeProfile.weight}</span><span>&bull;</span><span>{isViewingSelf ? t('you') : `${formatDistanceBigUnit(activeProfile.distance)} ${t('away')}`}</span><span>&bull;</span><span style={{ color: '#4ade80' }}>{renderLastSeenBigUnit(formatLastSeenBigUnit(activeProfile.last_seen), t)}</span>
              </div>
              {isViewingSelf && (<div style={{ display: 'flex', width: '100%', justifyContent: 'center', marginBottom: '14px', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <button type="button" onClick={handleHideAgeToggle} style={{ padding: '8px 16px', backgroundColor: hideAge ? '#e11d48' : '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>{hideAge ? t('ageHidden') : t('ageShown')}</button>
                {hideAgeExpiry && <span style={{ fontSize: '10px', color: '#888' }}>{t('expires')} {new Date(hideAgeExpiry).toLocaleDateString()}</span>}
              </div>)}
              {!isViewingSelf && (
                <div style={{ width: '100%', marginTop: '-42px', marginBottom: '8px', minHeight: '0' }}>
                  {showNoteBox && (<>
                    <textarea value={noteDraft} maxLength={100} onChange={(e) => savePrivateNote(activeProfile?.id, e.target.value)} placeholder={t('notePlaceholder')} rows={2} style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '6px 8px', backgroundColor: '#121212', color: '#eee', border: '1px solid #333', borderRadius: '6px', resize: 'none' }} />
                    <div style={{ fontSize: '10px', color: '#666', textAlign: 'right' }}>{noteDraft.length}/100</div>
                  </>)}
                </div>
              )}
              <div style={{ width: '100%', borderTop: '1px solid #333', margin: '4px 0 16px 0' }} />
              {targetIsManSeekingMan && (
                <div style={{ display: 'flex', gap: '6px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, padding: '10px 4px', backgroundColor: '#e11d48', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', opacity: 0.3, filter: 'grayscale(100%)' }}>{formatTagText(t(activeProfile.role_pref || 'Versatile'))}</div>
                  <div style={{ flex: 1, padding: '10px 4px', backgroundColor: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', opacity: 0.3, filter: 'grayscale(100%)' }}>{formatTagText(t(activeProfile.safety_pref || 'Safe'))}</div>
                  {isViewingSelf ? (<div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                    <button type="button" onClick={async () => { if (currentUser?.playstyle_pref !== 'Party' && currentUser?.playstyle_pref !== 'Party✓') return; const nextPlaystyle = playstylePref === 'Party✓' ? 'Party' : 'Party✓'; setPlaystylePref(nextPlaystyle); setFilterPlaystyleVal(nextPlaystyle); const updated = { ...activeProfile, playstyle_pref: nextPlaystyle }; setSelectedProfile(updated); await handleUpdateSelfField({ playstyle_pref: nextPlaystyle }); if (nextPlaystyle === 'Party✓') { setShowStuffBubble(true); setTimeout(() => setShowStuffBubble(false), 3000); } }} style={{ width: '100%', padding: '10px 4px', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: (currentUser?.playstyle_pref === 'Party' || currentUser?.playstyle_pref === 'Party✓') ? 'pointer' : 'not-allowed', textAlign: 'center', opacity: (currentUser?.playstyle_pref === 'Party' || currentUser?.playstyle_pref === 'Party✓') ? 1 : 0.4 }}>{formatTagText(t(playstylePref))}</button>
                    {showStuffBubble && (<div style={{ position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ffffff', color: '#000000', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', zIndex: 20 }}>{t('iGotStuff')}<div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: '#ffffff transparent transparent transparent' }} /></div>)}
                  </div>) : (<div style={{ flex: 1, padding: '10px 4px', backgroundColor: '#16a34a', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>{formatTagText(t(activeProfile.playstyle_pref || 'Clean'))}</div>)}
                  <div style={{ flex: 1, padding: '10px 4px', backgroundColor: '#9333ea', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', opacity: 0.3, filter: 'grayscale(100%)' }}>{formatTagText(t(activeProfile.how_many_pref || 'DoesntMatter'))}</div>
                  {isViewingSelf ? (<button type="button" onClick={async () => { const nextWhere = wherePref === 'Host' ? 'Travel' : (wherePref === 'Travel' ? null : 'Host'); setWherePref(nextWhere); const updated = { ...activeProfile, where_pref: nextWhere }; setSelectedProfile(updated); await handleUpdateSelfField({ where_pref: nextWhere }); }} style={{ flex: 1, padding: '10px 4px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', opacity: 1 }}>{formatTagText(wherePref === null ? t('Anywhere') : t(wherePref))}</button>) : (<div style={{ flex: 1, padding: '10px 4px', backgroundColor: '#d97706', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>{formatTagText(activeProfile.where_pref ? t(activeProfile.where_pref) : t('Anywhere'))}</div>)}
                </div>
              )}
              {!isViewingSelf && passesFilterForActive && (<button type="button" onClick={() => handleStartChat(activeProfile)} style={{ marginTop: '20px', width: '100%', padding: '14px', backgroundColor: '#0088cc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                {t('sendMessage')}
              </button>)}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 5000, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: 'rgba(30, 30, 30, 0.85)', borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px', boxShadow: '-2px 0px 8px rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
        <button onClick={() => setIsGamesMenuOpen(!isGamesMenuOpen)} style={{ background: 'none', border: 'none', fontSize: '32px', cursor: 'pointer', padding: 0, lineHeight: 1, filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.6))', transition: 'transform 0.2s ease', transform: isGamesMenuOpen ? 'scale(0.9)' : 'scale(1)' }} title={t('gamesApps')}>⭐</button>
        {isGamesMenuOpen && (<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          <img src={bustaIcon} alt="Busta" onClick={() => handleOpenExternalApp('https://t.me/bustagift_xbot/app?startapp=pal1231127407')} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #555' }} />
          <img src={tonflipIcon} alt="TonFlip" onClick={() => handleOpenExternalApp('https://app.tonflip.tg?r=mbab62ov')} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #555' }} />
          <img src={photifyIcon} alt="Photify" onClick={() => handleOpenExternalApp('https://t.me/PhotifyOfficialBot?start=referral_1231127407')} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #555' }} />
        </div>)}
      </div>

      <footer style={{ display: 'flex', height: '60px', minHeight: '60px', backgroundColor: '#1e1e1e', borderTop: '1px solid #333', zIndex: 10 }}>
        <button onClick={handleToggleGrid} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: view === 'grid' ? '#007bff' : '#888', cursor: 'pointer', position: 'relative' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span style={{ fontSize: '12px', marginTop: '4px', color: gridVisible ? '#007bff' : '#ff4d4d' }}>{t('grid')}</span>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: '75%', height: '3px', backgroundColor: gridVisible ? '#4ade80' : '#ff4d4d' }} />
        </button>
        <button onClick={() => handleOpenExternalApp(getActiveBotKey() === 'botA' ? 'https://t.me/hkmochat' : 'https://t.me/hkmochat')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#888', cursor: 'pointer', position: 'relative' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span style={{ fontSize: '12px', marginTop: '4px' }}>{t('chat')}</span>
        </button>
        <button onClick={handleWalletClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: isWalletConnected ? '#007bff' : '#ff4d4d', cursor: 'pointer', position: 'relative' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>
          <span style={{ fontSize: '12px', marginTop: '4px', color: isWalletConnected ? '#007bff' : '#ff4d4d' }}>{t('wallet')}</span>
          <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '50%', height: '3px', backgroundColor: isWalletConnected ? '#007bff' : '#ff4d4d' }} />
        </button>
        <button onClick={handleToggleMap} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: view === 'map' ? '#007bff' : '#888', cursor: 'pointer', position: 'relative' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
          <span style={{ fontSize: '12px', marginTop: '4px' }}>{t('map')}</span>
          <div style={{ position: 'absolute', bottom: 0, left: '50%', right: 0, height: '3px', backgroundColor: mapVisible ? '#4ade80' : '#ff4d4d' }} />
        </button>
      </footer>
    </div>
  );
}

