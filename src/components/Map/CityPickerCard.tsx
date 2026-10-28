import { useVisibleCities } from '@/hooks/data/useCities';
import { useSelectCity } from '@/hooks/features/useSelectCity';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { CitySelectionList } from './CitySelectionList';
import type { CityFacts } from '@shared/cities';

/** The phone's city picker, shown as a card in the map sheet; picking a city switches to it and closes the card. */
export const CityPickerCard = () => {
    const cities = useVisibleCities();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const selectCity = useSelectCity();
    const { setIsCityPickerOpen } = useUiStore(s => s.actions);

    const pick = (city: CityFacts) => {
        selectCity(city);
        setIsCityPickerOpen(false);
    };

    return (
        <div className="pt-1">
            <CitySelectionList cities={cities} selectedCitySlug={selectedCity || ''} onSelect={pick} />
        </div>
    );
};
