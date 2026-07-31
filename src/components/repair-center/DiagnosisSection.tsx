import React from "react";

interface DiagnosisSectionProps {
  technicalNotes: string;
  onNotesChange: (value: string) => void;
}

export function DiagnosisSection({
  technicalNotes,
  onNotesChange,
}: DiagnosisSectionProps) {
  return (
    <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl space-y-2.5">
      <label className="text-xs font-extrabold text-white block">
        تشخيص الفني
      </label>
      <textarea
        rows={4}
        placeholder="أدخل نتيجة التشخيص الفني، الفحص، والإجراءات المتبعة..."
        value={technicalNotes || ""}
        onChange={(e) => onNotesChange(e.target.value)}
        className="w-full bg-[#181b2a] border border-[#2a2d42] rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
      />
    </div>
  );
}

export default DiagnosisSection;
