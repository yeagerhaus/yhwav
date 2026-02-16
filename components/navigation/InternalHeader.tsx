import { Div } from '../Div';
import { HeaderBackButton } from './HeaderBackButton';

export function InternalHeader() {
	return (
		<Div
			transparent
			style={{
				position: 'absolute',
				top: 0,
				alignItems: 'center',
				backgroundColor: 'transparent',
				width: '100%',
			}}
		>
			<Div
				transparent
				style={{
					width: '100%',
					height: 100,
					display: 'flex',
					justifyContent: 'flex-end',
					backgroundColor: 'transparent',
				}}
			>
				<HeaderBackButton />
			</Div>
		</Div>
	);
}
