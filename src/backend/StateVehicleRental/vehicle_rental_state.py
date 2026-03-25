from vehicle_rental_context import VehicleRentalContext

class VehicleRentalState:
    status = 'unknown'

    def complete(self, context: VehicleRentalContext) -> dict[str, Any]:
        raise ValueError('Only active car rentals can be completed.')