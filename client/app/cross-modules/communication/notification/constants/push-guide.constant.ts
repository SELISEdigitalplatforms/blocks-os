import { textMap, tn } from "../i18n";

export interface IGuideSection {
  id: string;
  group?: string;
  heading: string;
  steps: string[];
}

export const GUIDE_TEXT = textMap({
  title: "PUSH_GUIDE.TITLE",
  intro: "PUSH_GUIDE.INTRO",
  failHeading: "PUSH_GUIDE.FAIL_HEADING",
});

/** A guide section whose group, heading and steps are read from the translations when used. */
const section = (
  id: string,
  groupKey: string,
  headingKey: string,
  stepKeys: readonly string[],
): IGuideSection => ({
  id,
  get group() {
    return tn(groupKey);
  },
  get heading() {
    return tn(headingKey);
  },
  get steps() {
    return stepKeys.map((key) => tn(key));
  },
});

export const GUIDE_SECTIONS: IGuideSection[] = [
  section("key", "PUSH_GUIDE.KEY_GROUP", "PUSH_GUIDE.KEY_HEADING", [
    "PUSH_GUIDE.KEY_STEP_1",
    "PUSH_GUIDE.KEY_STEP_2",
    "PUSH_GUIDE.KEY_STEP_3",
    "PUSH_GUIDE.KEY_STEP_4",
    "PUSH_GUIDE.KEY_STEP_5",
    "PUSH_GUIDE.KEY_STEP_6",
  ]),
  section("android", "PUSH_GUIDE.ANDROID_GROUP", "PUSH_GUIDE.ANDROID_HEADING", [
    "PUSH_GUIDE.ANDROID_STEP_1",
    "PUSH_GUIDE.ANDROID_STEP_2",
    "PUSH_GUIDE.ANDROID_STEP_3",
  ]),
  section("ios", "PUSH_GUIDE.IOS_GROUP", "PUSH_GUIDE.IOS_HEADING", [
    "PUSH_GUIDE.IOS_STEP_1",
    "PUSH_GUIDE.IOS_STEP_2",
    "PUSH_GUIDE.IOS_STEP_3",
    "PUSH_GUIDE.IOS_STEP_4",
    "PUSH_GUIDE.IOS_STEP_5",
    "PUSH_GUIDE.IOS_STEP_6",
  ]),
  section("web", "PUSH_GUIDE.WEB_GROUP", "PUSH_GUIDE.WEB_HEADING", [
    "PUSH_GUIDE.WEB_STEP_1",
    "PUSH_GUIDE.WEB_STEP_2",
    "PUSH_GUIDE.WEB_STEP_3",
    "PUSH_GUIDE.WEB_STEP_4",
  ]),
];

const failure = (titleKey: string, textKey: string): { title: string; text: string } => ({
  get title() {
    return tn(titleKey);
  },
  get text() {
    return tn(textKey);
  },
});

export const IOS_FAILURES: { title: string; text: string }[] = [
  failure("PUSH_GUIDE.FAIL_APNS_MISSING_TITLE", "PUSH_GUIDE.FAIL_APNS_MISSING_TEXT"),
  failure("PUSH_GUIDE.FAIL_APNS_REJECTED_TITLE", "PUSH_GUIDE.FAIL_APNS_REJECTED_TEXT"),
  failure("PUSH_GUIDE.FAIL_WRONG_APP_TITLE", "PUSH_GUIDE.FAIL_WRONG_APP_TEXT"),
  failure("PUSH_GUIDE.FAIL_TOKEN_EXPIRED_TITLE", "PUSH_GUIDE.FAIL_TOKEN_EXPIRED_TEXT"),
  failure("PUSH_GUIDE.FAIL_NO_DEVICE_TITLE", "PUSH_GUIDE.FAIL_NO_DEVICE_TEXT"),
  failure("PUSH_GUIDE.FAIL_NOTHING_SHOWS_TITLE", "PUSH_GUIDE.FAIL_NOTHING_SHOWS_TEXT"),
  failure("PUSH_GUIDE.FAIL_STILL_TITLE", "PUSH_GUIDE.FAIL_STILL_TEXT"),
];
