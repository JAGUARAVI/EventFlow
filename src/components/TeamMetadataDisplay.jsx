import { useState, useEffect } from "react";

import { supabase } from "../lib/supabase";

/**
 * Component to display team metadata values
 */
export default function TeamMetadataDisplay({ eventId, teamMetadata = {} }) {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTemplate();
    }, [eventId]);

    const loadTemplate = async () => {
        if (!eventId) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("metadata_templates")
            .select("*")
            .eq("event_id", eventId)
            .maybeSingle();

        if (!error && data) {
            setTemplate(data);
        }
        setLoading(false);
    };

    if (
        loading ||
        !template ||
        !template.fields_json ||
        template.fields_json.length === 0
    ) {
        return null;
    }

    const fields = template.fields_json;
    const hasValues = fields.some((f) => teamMetadata[f.id]);

    if (!hasValues) {
        return null;
    }

    const formatValue = (value) => {
        if (Array.isArray(value)) {
            return value.join(", ");
        }
        return String(value || "—");
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            {fields.map((field) => {
                const value = teamMetadata[field.id];
                if (!value) return null;

                return (
                    <div key={field.id} className="text-sm">
                        <span className="text-default-500 font-medium">
                            {field.name}:
                        </span>
                        <span className="ml-2">{formatValue(value)}</span>
                    </div>
                );
            })}
        </div>
    );
}
