'use client';

import { TeamRoster } from "@/components/TeamRoster";
import { PeopleAllocationView } from "@/components/PeopleAllocationView";

export default function TeamPage() {
  return (
    <div className="space-y-10">
      <TeamRoster />
      <section>
        <PeopleAllocationView />
      </section>
    </div>
  );
}
