import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PublicLanguage = "en" | "zh";

const storageKey = "publicLanguage";

const en: Record<string, string> = {
  "common.languageToggle": "中文",
  "common.backToRoomStatus": "Back to room status",
  "timeZone.business": "Business time zone",
  "status.confirmed": "Confirmed",
  "status.pending_approval": "Pending approval",
  "booking.title": "Book a Meeting Room",
  "booking.defaultDescription": "Reserve a room by selecting a time and providing your contact details.",
  "booking.selectRoomOpening": "Select a room to view opening hours.",
  "booking.error.loadRooms": "Could not load rooms.",
  "booking.error.loadBookings": "Could not load bookings.",
  "booking.error.booking_conflict": "This time is already occupied by an existing booking.",
  "booking.error.invalid_time_range": "End time must be after start time.",
  "booking.error.outside_opening_hours": "Booking date must be within this room's opening dates.",
  "booking.error.booking_too_far_in_advance": "Booking is too far in advance for this room.",
  "booking.error.duration_too_short": "Booking is shorter than the minimum duration.",
  "booking.error.duration_too_long": "Booking is longer than the maximum duration.",
  "booking.error.room_disabled": "This room is not available for booking.",
  "booking.error.slot_interval_invalid": "Start and end times must match this room's booking interval.",
  "booking.error.selectedConflict": "Selected time is already occupied by an existing booking.",
  "booking.error.selectedBufferConflict": "Selected time is too close to an existing booking buffer.",
  "booking.error.outOfOpeningTime": "Booking time must be within this room's opening time range.",
  "booking.error.invalidEmail": "Please enter a valid email address.",
  "booking.error.fillRequired": "Please fill in all required fields.",
  "booking.error.failed": "Booking failed.",
  "booking.success.confirmed": "Booking confirmed. We've reserved the room for you.",
  "booking.success.pending": "Booking submitted. An administrator will review and confirm shortly.",
  "booking.room": "Room *",
  "booking.selectRoom": "Select a room",
  "booking.meetingTitle": "Meeting title *",
  "booking.contactName": "Contact name *",
  "booking.email": "Email *",
  "booking.date": "Booking date *",
  "booking.start": "Start time *",
  "booking.end": "End time *",
  "booking.guidance.timeZone": "Times are shown and submitted as {{timeZone}}.",
  "booking.guidance.selectRoom": "Select a room to view booking limits.",
  "booking.guidance.minDuration": "Minimum booking duration is {{duration}}.",
  "booking.guidance.maxDuration": "Maximum meeting duration is {{duration}}.",
  "booking.guidance.maxAdvance": "Bookings can be made up to {{duration}} in advance.",
  "booking.guidance.buffer": "A {{minutes}}-minute buffer between meetings is required.",
  "booking.guidance.noBuffer": "No buffer between meetings is required.",
  "booking.guidance.requiresApproval": "Bookings require administrator approval.",
  "booking.guidance.autoConfirm": "Bookings are confirmed automatically.",
  "booking.openingHours": "Bookings are available from {{startDate}} to {{endDate}}, from {{start}} to {{end}} ({{timeZone}}).",
  "booking.schedule.title": "Current room bookings",
  "booking.schedule.selectDate": "Select a date",
  "booking.schedule.emptyPrompt": "Select a room and date to view existing bookings.",
  "booking.schedule.loading": "Loading bookings...",
  "booking.schedule.empty": "No bookings for this date.",
  "booking.schedule.itemTitle": "meeting{{count}}",
  "booking.submit.loading": "Submitting...",
  "booking.submit.idle": "Book room",
  "booking.footnote": "If you need to cancel or change a meeting, contact your meeting room administrator.",
  "tablet.loading": "Loading tablet...",
  "tablet.error": "Could not load tablet.",
  "tablet.error.loadBookings": "Could not load bookings.",
  "tablet.logoAlt": "CapyMeet logo",
  "tablet.roomStatus": "Room status",
  "tablet.switchRoom": "Switch room",
  "tablet.roomKicker": "Meeting Room",
  "tablet.noRoom": "No room selected",
  "tablet.capacity.person": "({{count}} person)",
  "tablet.capacity.people": "({{count}} people)",
  "tablet.status.inUse": "In Use",
  "tablet.status.available": "Available",
  "tablet.current.now": "Now: {{title}}",
  "tablet.current.host": "Host: {{name}}",
  "tablet.current.time": "Time ({{timeZone}}): {{time}}",
  "tablet.current.status": "Status: Confirmed",
  "tablet.qr.group": "Room booking QR code",
  "tablet.qr.title": "Scan to book this room",
  "tablet.qr.description": "Scan with your mobile device to book this room.",
  "tablet.qr.limits": "Maximum meeting duration is {{max}} minutes. Minimum booking duration is {{min}} minutes.",
  "tablet.qr.imageAlt": "Booking QR code for {{room}}",
  "tablet.qr.generating": "Generating QR code...",
  "tablet.schedule.label": "Today's bookings",
  "tablet.schedule.title": "Today's bookings",
  "tablet.schedule.syncing": "Syncing...",
  "tablet.schedule.loading": "Loading bookings...",
  "tablet.schedule.empty": "No bookings today.",
  "tablet.timeState.current": "Now",
  "tablet.timeState.past": "Ended",
  "tablet.timeState.upcoming": "Upcoming",
  "tablet.schedule.itemMeta": "{{contactName}} · Confirmed",
  "cancel.title": "Cancellation unavailable",
  "cancel.description": "Self-service cancellation has been removed. Please contact an administrator if a booking needs changes.",
  "cancel.footnoteStart": "Need to make a new booking? Visit ",
  "cancel.footnoteLink": "the booking page",
  "cancel.footnoteEnd": ".",
};

const zh: Record<string, string> = {
  ...en,
  "common.languageToggle": "English",
  "common.backToRoomStatus": "返回房间状态",
  "timeZone.business": "业务时区",
  "status.confirmed": "已确认",
  "status.pending_approval": "待审批",
  "booking.title": "预订会议室",
  "booking.defaultDescription": "选择时间并填写联系信息即可预订会议室。",
  "booking.selectRoomOpening": "请选择会议室以查看开放时间。",
  "booking.error.loadRooms": "无法加载会议室。",
  "booking.error.loadBookings": "无法加载预订。",
  "booking.error.booking_conflict": "该时间已被现有预订占用。",
  "booking.error.invalid_time_range": "结束时间必须晚于开始时间。",
  "booking.error.outside_opening_hours": "预订日期必须在该会议室开放日期内。",
  "booking.error.booking_too_far_in_advance": "预订时间超出了该会议室允许的提前预约范围。",
  "booking.error.duration_too_short": "预订时长短于最短时长。",
  "booking.error.duration_too_long": "预订时长超过最长时长。",
  "booking.error.room_disabled": "该会议室当前不可预订。",
  "booking.error.slot_interval_invalid": "开始和结束时间必须符合该会议室的预订间隔。",
  "booking.error.selectedConflict": "所选时间已被现有预订占用。",
  "booking.error.selectedBufferConflict": "所选时间距离现有预订缓冲时间过近。",
  "booking.error.outOfOpeningTime": "预订时间必须在该会议室开放时段内。",
  "booking.error.invalidEmail": "请输入有效的邮箱地址。",
  "booking.error.fillRequired": "请填写所有必填项。",
  "booking.error.failed": "预订失败。",
  "booking.success.confirmed": "预订已确认，会议室已为你保留。",
  "booking.success.pending": "预订已提交，管理员会尽快审核确认。",
  "booking.room": "会议室 *",
  "booking.selectRoom": "选择会议室",
  "booking.meetingTitle": "会议标题 *",
  "booking.contactName": "联系人 *",
  "booking.email": "邮箱 *",
  "booking.date": "预订日期 *",
  "booking.start": "开始时间 *",
  "booking.end": "结束时间 *",
  "booking.guidance.timeZone": "时间显示和提交均使用{{timeZone}}。",
  "booking.guidance.selectRoom": "请选择会议室以查看预订限制。",
  "booking.guidance.minDuration": "最短预订时长为 {{duration}}。",
  "booking.guidance.maxDuration": "最长会议时长为 {{duration}}。",
  "booking.guidance.maxAdvance": "最多可提前 {{duration}} 预订。",
  "booking.guidance.buffer": "会议之间需要 {{minutes}} 分钟缓冲时间。",
  "booking.guidance.noBuffer": "会议之间不需要缓冲时间。",
  "booking.guidance.requiresApproval": "预订需要管理员审核。",
  "booking.guidance.autoConfirm": "预订会自动确认。",
  "booking.openingHours": "预订开放时间为 {{startDate}} 至 {{endDate}}，{{start}} 至 {{end}}（{{timeZone}}）。",
  "booking.schedule.title": "当前会议室预订",
  "booking.schedule.selectDate": "选择日期",
  "booking.schedule.emptyPrompt": "请选择会议室和日期以查看已有预订。",
  "booking.schedule.loading": "正在加载预订...",
  "booking.schedule.empty": "该日期暂无预订。",
  "booking.schedule.itemTitle": "会议{{count}}",
  "booking.submit.loading": "正在提交...",
  "booking.submit.idle": "预订会议室",
  "booking.footnote": "如需取消或修改会议，请联系会议室管理员。",
  "tablet.loading": "正在加载 Pad...",
  "tablet.error": "无法加载 Pad。",
  "tablet.error.loadBookings": "无法加载预订。",
  "tablet.logoAlt": "CapyMeet 标志",
  "tablet.roomStatus": "房间状态",
  "tablet.switchRoom": "切换会议室",
  "tablet.roomKicker": "会议室",
  "tablet.noRoom": "未选择会议室",
  "tablet.capacity.person": "（{{count}} 人）",
  "tablet.capacity.people": "（{{count}} 人）",
  "tablet.status.inUse": "使用中",
  "tablet.status.available": "空闲",
  "tablet.current.now": "当前：{{title}}",
  "tablet.current.host": "主持人：{{name}}",
  "tablet.current.time": "时间（{{timeZone}}）：{{time}}",
  "tablet.current.status": "状态：已确认",
  "tablet.qr.group": "会议室预订二维码",
  "tablet.qr.title": "扫码预订此会议室",
  "tablet.qr.description": "请用手机扫码预订此会议室。",
  "tablet.qr.limits": "最长会议时长为 {{max}} 分钟，最短预订时长为 {{min}} 分钟。",
  "tablet.qr.imageAlt": "{{room}} 的预订二维码",
  "tablet.qr.generating": "正在生成二维码...",
  "tablet.schedule.label": "今日预订",
  "tablet.schedule.title": "今日预订",
  "tablet.schedule.syncing": "同步中...",
  "tablet.schedule.loading": "正在加载预订...",
  "tablet.schedule.empty": "今天暂无预订。",
  "tablet.timeState.current": "当前",
  "tablet.timeState.past": "已结束",
  "tablet.timeState.upcoming": "即将开始",
  "tablet.schedule.itemMeta": "{{contactName}} · 已确认",
  "cancel.title": "无法取消预订",
  "cancel.description": "自助取消功能已移除。如需修改预订，请联系管理员。",
  "cancel.footnoteStart": "需要新建预订？请访问",
  "cancel.footnoteLink": "预订页面",
  "cancel.footnoteEnd": "。",
};

const dictionaries = { en, zh };

interface PublicI18nContextValue {
  language: PublicLanguage;
  setLanguage: (language: PublicLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const PublicI18nContext = createContext<PublicI18nContextValue | null>(null);

function translate(language: PublicLanguage, key: string, values: Record<string, string | number> = {}) {
  const template = dictionaries[language][key] ?? en[key] ?? key;
  return Object.entries(values).reduce(
    (result, [name, replacement]) => result.replaceAll(`{{${name}}}`, String(replacement)),
    template,
  );
}

function readInitialLanguage(): PublicLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  return window.localStorage.getItem(storageKey) === "zh" ? "zh" : "en";
}

export function PublicI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<PublicLanguage>(() => readInitialLanguage());

  const value = useMemo<PublicI18nContextValue>(() => {
    function setLanguage(nextLanguage: PublicLanguage) {
      setLanguageState(nextLanguage);
      window.localStorage.setItem(storageKey, nextLanguage);
    }

    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "zh" : "en"),
      t: (key: string, values: Record<string, string | number> = {}) => translate(language, key, values),
    };
  }, [language]);

  return <PublicI18nContext.Provider value={value}>{children}</PublicI18nContext.Provider>;
}

export function usePublicI18n() {
  const context = useContext(PublicI18nContext);
  if (!context) {
    return {
      language: "en" as const,
      setLanguage: () => undefined,
      toggleLanguage: () => undefined,
      t: (key: string, values: Record<string, string | number> = {}) => translate("en", key, values),
    };
  }
  return context;
}

export function PublicLanguageToggle({ className = "button button--ghost public-language-toggle" }: { className?: string }) {
  const { t, toggleLanguage } = usePublicI18n();

  return (
    <button className={className} type="button" onClick={toggleLanguage}>
      {t("common.languageToggle")}
    </button>
  );
}
