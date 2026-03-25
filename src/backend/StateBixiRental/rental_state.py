from bixi_context import BixiRentalContext

# Each rental phase owns the transitions and station adjustments that are valid from that phase.
# Base state class defines how methods each state can repsond to, like pay and return bike
class RentalState:
    status = 'unknown'

    def pay(self, context: BixiRentalContext, payment_result: dict[str, Any]) -> None:
        raise ValueError('Only reserved rentals can be paid and activated.')

    def return_bike(self, context: BixiRentalContext, return_station: dict[str, Any]) -> None:
        raise ValueError('Only active rentals can be returned.')

    def is_open(self) -> bool:
        return False

    def is_completed(self) -> bool:
        return False

    def pickup_bike_delta(self) -> int:
        return -1

    def pickup_dock_delta(self) -> int:
        return 0

    def return_bike_delta(self) -> int:
        return 0

    def return_dock_delta(self) -> int:
        return 0