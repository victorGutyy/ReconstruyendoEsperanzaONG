import { NativeSelect } from "@/components/ui/native-select";

import type { OwnerOptions } from "../types";

/**
 * "Pertenece a": an activity, a project or nothing. The value is "",
 * "activity:<id>" or "project:<id>" (galleries and videos, step 7.6c).
 */
export function OwnerSelect({
  id,
  value,
  onChange,
  owners,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  owners: OwnerOptions;
}) {
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Ninguna actividad ni proyecto</option>
      {owners.activities.length > 0 ? (
        <optgroup label="Actividades">
          {owners.activities.map((activity) => (
            <option key={activity.id} value={`activity:${activity.id}`}>
              {activity.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {owners.projects.length > 0 ? (
        <optgroup label="Proyectos">
          {owners.projects.map((project) => (
            <option key={project.id} value={`project:${project.id}`}>
              {project.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </NativeSelect>
  );
}
